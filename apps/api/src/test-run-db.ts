/**
 * Run numbers and their fixtures (schema testschema). The rules are in docs/fixture-prisma-guide.md.
 *
 * One number line for the Web and the App. A platform joins the newest number when it has not run it yet;
 * otherwise (or when that number is blocked) newest + 1 is opened with new values. Older numbers are closed.
 */
import { PlatformRun, TestPlatform, TestRun } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import { HttpError } from "./http-error";
import { makeFixtureRows } from "./test-fixture-rules";
import { fixturePassword } from "./test-run-secret";

/** A running platform without a signal for this long has died: its number becomes blocked. */
export const SIGNAL_LIMIT_MS = 10 * 60 * 1000;

const LOCK = 7_201_217; // any fixed number: every change of the run numbers waits for this lock

/** Runs one change at a time (two platforms can start at the same moment), after blocking the runs that died. */
const changeRuns = <T>(now: Date, change: (tx: DbClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK})`;
      const dead = await tx.platformRun.findMany({
        where: {
          status: "running",
          lastSignalAt: { lt: new Date(now.getTime() - SIGNAL_LIMIT_MS) },
        },
      });
      for (const run of dead) await blockPlatformRun(tx, run);
      return change(tx);
    },
    { maxWait: 15_000, timeout: 15_000 }
  );

const blockPlatformRun = async (tx: DbClient, run: PlatformRun) => {
  await tx.platformRun.update({ where: { id: run.id }, data: { status: "blocked" } });
  await tx.testRun.update({ where: { runNo: run.runNo }, data: { status: "blocked" } });
};

const PLATFORM_MARK: Record<TestPlatform, string> = { web: "w", app: "a" };

export type Fixtures = Record<string, Record<string, string>>;

/** The stored values of a number, by test label. */
const readFixtures = async (tx: DbClient, runNo: number): Promise<Fixtures> => {
  const rows = await tx.testFixture.findMany({
    where: { runNo },
    orderBy: [{ testCase: "asc" }, { item: "asc" }],
  });
  const fixtures: Fixtures = {};
  for (const { testCase, item, value } of rows) (fixtures[testCase] ??= {})[item] = value;
  return fixtures;
};

/** The values as a test uses them: username (base + number + platform) and password are added for every person. */
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
      out[testCase][`${person}.username`] = `${value}${runNo}${PLATFORM_MARK[platform]}`;
      out[testCase][`${person}.password`] = fixturePassword(secret, runNo, testCase, person);
    }
  }
  return out;
};

export interface StartedRun {
  runNo: number;
  /** true when this start opened the number, false when it joined one that the other platform opened */
  opened: boolean;
  fixtures: Fixtures;
}

/** "This platform starts": joins the newest number or opens the next one. */
export const startRun = (
  platform: TestPlatform,
  device: string | undefined,
  secret: string,
  now = new Date()
): Promise<StartedRun> =>
  changeRuns(now, async (tx) => {
    const newest = await tx.testRun.findFirst({
      orderBy: { runNo: "desc" },
      include: { platformRuns: true },
    });
    const canJoin =
      newest?.status === "open" && !newest.platformRuns.some((run) => run.platform === platform);

    // newest + 1, not the sequence of the column: a sequence loses a number when a request fails
    const runNo = canJoin ? newest.runNo : (newest?.runNo ?? 0) + 1;
    if (!canJoin) await tx.testRun.create({ data: { runNo, openedBy: platform, createdAt: now } });

    // an open number gets the values of rules that were added after it was opened; stored values stay
    await tx.testFixture.createMany({ data: makeFixtureRows(runNo), skipDuplicates: true });
    await tx.platformRun.create({
      data: { runNo, platform, device, startedAt: now, lastSignalAt: now },
    });

    const fixtures = forPlatform(await readFixtures(tx, runNo), runNo, platform, secret);
    return { runNo, opened: !canJoin, fixtures };
  });

export type RunEvent = "signal" | "finish" | "block";

/** What a running platform tells about itself. Returns the state of the number after it. */
export const reportRun = async (
  runNo: number,
  platform: TestPlatform,
  event: RunEvent,
  now = new Date()
): Promise<{ runNo: number; status: TestRun["status"]; platformStatus: PlatformRun["status"] }> => {
  // the answer is returned, not thrown, so that blocking the dead runs is saved also when the report is refused
  const answer = await changeRuns(now, async (tx) => {
    const run = await tx.platformRun.findUnique({
      where: { runNo_platform: { runNo, platform } },
    });
    if (!run) return new HttpError(404, "this platform has not started this run number");
    if (run.status !== "running") {
      return new HttpError(409, `this run is not running any more (${run.status})`);
    }

    if (event === "block") await blockPlatformRun(tx, run);
    else {
      await tx.platformRun.update({
        where: { id: run.id },
        data: {
          lastSignalAt: now,
          ...(event === "finish" ? { status: "finished", finishedAt: now } : {}),
        },
      });
    }

    const after = await tx.platformRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { run: true },
    });
    return { runNo, status: after.run.status, platformStatus: after.status };
  });
  if (answer instanceof HttpError) throw answer;
  return answer;
};

/** Every number with its date and states, newest first (the regression check chooses from this list). */
export const listRuns = (now = new Date()) =>
  changeRuns(now, (tx) =>
    tx.testRun.findMany({
      orderBy: { runNo: "desc" },
      include: {
        platformRuns: {
          select: {
            platform: true,
            status: true,
            device: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { platform: "asc" },
        },
      },
    })
  );

/** The values of one number, as that platform used them. Reading never makes a new value. */
export const getRunFixtures = async (
  runNo: number,
  platform: TestPlatform,
  secret: string
): Promise<Fixtures> => {
  if (!(await prisma.testRun.findUnique({ where: { runNo } }))) {
    throw new HttpError(404, "this run number does not exist");
  }
  return forPlatform(await readFixtures(prisma, runNo), runNo, platform, secret);
};

/** For everyone (the demo): the values of the newest number, without anything that names or opens an account. */
export const getLatestPublicFixtures = async (): Promise<{
  runNo: number | null;
  fixtures: Fixtures;
}> => {
  const newest = await prisma.testRun.findFirst({ orderBy: { runNo: "desc" } });
  if (!newest) return { runNo: null, fixtures: {} };

  const fixtures = await readFixtures(prisma, newest.runNo);
  for (const items of Object.values(fixtures)) {
    for (const item of Object.keys(items)) if (item.endsWith(".usernameBase")) delete items[item];
  }
  return { runNo: newest.runNo, fixtures };
};
