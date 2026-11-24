/**
 * Run numbers and their fixtures (schema testschema). The rules are in docs/fixture-prisma-guide.md.
 *
 * One number line for the Web and the App. A platform joins the newest number when it has not run it yet;
 * otherwise (or when that number is blocked) newest + 1 is opened with new values. Older numbers are closed.
 */
import { RunProgress, RunStatus, TestFixturePerson, TestPlatform } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import { HttpError } from "./http-error";
import { SERVER_FINGERPRINT } from "./server-fingerprint";
import {
  FIXTURE_RULES,
  FixtureValues,
  makeFixturePeople,
  makeFixtureValues,
  usernameOf,
} from "./test-fixture-rules";
import { finalResultOf, writeReport } from "./test-report-db";
import { fixturePassword } from "./test-run-secret";
import { versionOf } from "./test-version-db";

/** A running platform without a signal for this long has died: its number becomes blocked. */
export const SIGNAL_LIMIT_MS = 10 * 60 * 1000;

const LOCK = 7_201_217; // any fixed number: every change of the run numbers waits for this lock

/** Runs one change at a time (two platforms can start at the same moment), after blocking the runs that died. */
export const changeRuns = <T>(now: Date, change: (tx: DbClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK})`;
      const dead = await tx.runProgress.findMany({
        where: {
          status: "running",
          lastSignalAt: { lt: new Date(now.getTime() - SIGNAL_LIMIT_MS) },
        },
      });
      for (const run of dead) await endRun(tx, run, "blocked", now, null);
      return change(tx);
    },
    { maxWait: 15_000, timeout: 15_000 }
  );

const serverVersionNow = (tx: DbClient, now: Date) =>
  versionOf(tx, "server", SERVER_FINGERPRINT, now);

/** The end of a platform's run: its progress and its report are written together. */
const endRun = async (
  tx: DbClient,
  { runNo, platform }: RunProgress,
  status: "finished" | "blocked",
  now: Date,
  serverVersionEnd: string | null // null: the run died, nobody knows the server it ended with
) => {
  await tx.runProgress.update({
    where: { runNo_platform: { runNo, platform } },
    data: {
      status,
      serverVersionEnd,
      ...(status === "finished" ? { lastSignalAt: now, finishedAt: now } : {}),
    },
  });
  await writeReport(tx, runNo, platform, status, now);
};

export type NumberStatus = "open" | "blocked";

/** One platform that stopped midway blocks the whole number. */
const numberStatus = (progress: { status: RunStatus }[]): NumberStatus =>
  progress.some((run) => run.status === "blocked") ? "blocked" : "open";

export type Fixtures = Record<string, Record<string, string>>;

const personItems = ({ person, ...values }: TestFixturePerson): Record<string, string> => ({
  [`${person}.usernameBase`]: values.usernameBase,
  [`${person}.firstName`]: values.firstName,
  [`${person}.lastName`]: values.lastName,
  [`${person}.phoneNumber`]: values.phoneNumber,
  [`${person}.bankName`]: values.bankName,
  [`${person}.accountNumber`]: values.accountNumber,
  [`${person}.partition.username`]: values.partitionUsername,
  [`${person}.partition.name`]: values.partitionName,
  [`${person}.partition.phone`]: values.partitionPhone,
  [`${person}.partition.accountLength`]: String(values.partitionAccountLength),
});

/** The stored values of a number, by test label: every test gets its people and its own values. */
const readFixtures = async (tx: DbClient, runNo: number): Promise<Fixtures> => {
  const stored = await tx.testFixture.findUniqueOrThrow({
    where: { runNo },
    include: { people: true },
  });
  const fixtures: Fixtures = {};
  for (const [testCase, rule] of Object.entries(FIXTURE_RULES)) {
    const items: Record<string, string> = {};
    for (const person of rule.people) {
      const row = stored.people.find((one) => one.person === person);
      if (row) Object.assign(items, personItems(row));
    }
    for (const [item, column] of Object.entries(rule.values ?? {})) {
      if (stored[column] !== null) items[item] = String(stored[column]);
    }
    fixtures[testCase] = items;
  }
  return fixtures;
};

/** Makes the values that the number does not have yet: all of a new number, or new columns of an open one. */
const fillFixtures = async (tx: DbClient, runNo: number) => {
  const stored = await tx.testFixture.findUniqueOrThrow({ where: { runNo } });
  const made = makeFixtureValues();
  const columns = Object.keys(made) as (keyof FixtureValues)[];
  const missing = columns.filter((column) => stored[column] === null);
  await tx.testFixture.update({
    where: { runNo },
    data: Object.fromEntries(missing.map((column) => [column, made[column]])),
  });
  await tx.testFixturePerson.createMany({ data: makeFixturePeople(runNo), skipDuplicates: true });
};

/** The values as a test uses them: username and password are added for every person. */
const forPlatform = (
  fixtures: Fixtures,
  runNo: number,
  platform: TestPlatform,
  secret: string
): Fixtures => {
  const out: Fixtures = {};
  for (const [testCase, items] of Object.entries(fixtures)) {
    out[testCase] = { ...items };
    for (const [item, value] of Object.entries(items)) {
      const [person, name] = item.split(".");
      if (name !== "usernameBase") continue;
      out[testCase][`${person}.username`] = usernameOf(value, testCase, runNo, platform);
      out[testCase][`${person}.password`] = fixturePassword(secret, runNo, testCase, person);
    }
  }
  return out;
};

/** The code a platform runs with. Every part may be unknown. */
export interface RunCode {
  testCommit?: string;
  testDirty?: boolean;
  /** The fingerprint of the Web screens or of the App build */
  target?: string;
}

export interface StartedRun {
  runNo: number;
  /** true when this start opened the number, false when it joined one that the other platform opened */
  opened: boolean;
  versions: { server: string; target: string | null };
  fixtures: Fixtures;
}

/** "This platform starts": joins the newest number or opens the next one. */
export const startRun = (
  platform: TestPlatform,
  device: string | undefined,
  secret: string,
  now = new Date(),
  { testCommit, testDirty, target }: RunCode = {}
): Promise<StartedRun> =>
  changeRuns(now, async (tx) => {
    const newest = await tx.testFixture.findFirst({
      orderBy: { runNo: "desc" },
      include: { progress: true },
    });
    const canJoin =
      newest !== null &&
      numberStatus(newest.progress) === "open" &&
      !newest.progress.some((run) => run.platform === platform);

    // newest + 1, not a sequence: a sequence loses a number when a request fails
    const runNo = canJoin ? newest.runNo : (newest?.runNo ?? 0) + 1;
    if (!canJoin) {
      await tx.testFixture.create({ data: { runNo, openedBy: platform, createdAt: now } });
    }

    await fillFixtures(tx, runNo); // stored values stay
    const serverVersion = await serverVersionNow(tx, now);
    const targetVersion = target ? await versionOf(tx, platform, target, now) : null;
    await tx.runProgress.create({
      data: {
        runNo,
        platform,
        device,
        startedAt: now,
        lastSignalAt: now,
        serverVersion,
        targetVersion,
        testCommit,
        testDirty,
      },
    });

    const fixtures = forPlatform(await readFixtures(tx, runNo), runNo, platform, secret);
    const versions = { server: serverVersion, target: targetVersion };
    return { runNo, opened: !canJoin, versions, fixtures };
  });

export type RunEvent = "signal" | "finish" | "block";

export interface RunState {
  runNo: number;
  status: NumberStatus;
  platformStatus: RunStatus;
  /** "pending" until both platforms have ended */
  finalResult: string;
}

/** What a running platform tells about itself. Returns the state of the number after it. */
export const reportRun = async (
  runNo: number,
  platform: TestPlatform,
  event: RunEvent,
  now = new Date()
): Promise<RunState> => {
  // the answer is returned, not thrown, so that blocking the dead runs is saved also when the report is refused
  const answer = await changeRuns(now, async (tx) => {
    const where = { runNo_platform: { runNo, platform } };
    const run = await tx.runProgress.findUnique({ where });
    if (!run) return new HttpError(404, "this platform has not started this run number");
    if (run.status !== "running") {
      return new HttpError(409, `this run is not running any more (${run.status})`);
    }

    if (event === "signal") await tx.runProgress.update({ where, data: { lastSignalAt: now } });
    else {
      const status = event === "finish" ? "finished" : "blocked";
      await endRun(tx, run, status, now, await serverVersionNow(tx, now));
    }

    const progress = await tx.runProgress.findMany({ where: { runNo } });
    return {
      runNo,
      status: numberStatus(progress),
      platformStatus: progress.find((one) => one.platform === platform)!.status,
      finalResult: await finalResultOf(tx, runNo),
    };
  });
  if (answer instanceof HttpError) throw answer;
  return answer;
};

/** Every number with its date and states, newest first (the regression check chooses from this list). */
export const listRuns = (now = new Date()) =>
  changeRuns(now, async (tx) => {
    const numbers = await tx.testFixture.findMany({
      orderBy: { runNo: "desc" },
      select: {
        runNo: true,
        openedBy: true,
        createdAt: true,
        progress: {
          select: {
            platform: true,
            status: true,
            device: true,
            startedAt: true,
            finishedAt: true,
            serverVersion: true,
            targetVersion: true,
          },
          orderBy: { platform: "asc" },
        },
      },
    });
    // "status" and "platformRuns" are the names that the test runners read
    return numbers.map(({ progress, ...number }) => ({
      ...number,
      status: numberStatus(progress),
      platformRuns: progress,
    }));
  });

/** The values of one number, as that platform used them. Reading never makes a new value. */
export const getRunFixtures = async (
  runNo: number,
  platform: TestPlatform,
  secret: string
): Promise<Fixtures> => {
  if (!(await prisma.testFixture.findUnique({ where: { runNo } }))) {
    throw new HttpError(404, "this run number does not exist");
  }
  return forPlatform(await readFixtures(prisma, runNo), runNo, platform, secret);
};

/** For everyone (the demo): the values of the newest number, without anything that names or opens an account. */
export const getLatestPublicFixtures = async (): Promise<{
  runNo: number | null;
  fixtures: Fixtures;
}> => {
  const newest = await prisma.testFixture.findFirst({ orderBy: { runNo: "desc" } });
  if (!newest) return { runNo: null, fixtures: {} };

  const fixtures = await readFixtures(prisma, newest.runNo);
  for (const items of Object.values(fixtures)) {
    for (const item of Object.keys(items)) if (item.endsWith(".usernameBase")) delete items[item];
  }
  return { runNo: newest.runNo, fixtures };
};
