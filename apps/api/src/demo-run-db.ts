/**
 * What visitors did with the demo (schema testschema): one row for every demo that was started (demo_run) and one for
 * every test it played (demo_test_record). It has nothing to do with the run numbers of the real Playwright.
 *
 * A demo lives in the visitor's browser, so the server cannot see its end. Three things tell it:
 *  - the browser says so: the end, the stop button, or the page that is closed
 *  - no signal for LOST_MS: the browser is gone (it crashed, or the network is off)
 * A demo that is not going on has `endedAt`. Nothing else has to be looked at.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { DemoRunMode, DemoRunStatus, DemoStopReason } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import { HttpError } from "./http-error";
import { shortError } from "./test-result-db";

/** Browsers slow down the timers of a hidden tab to one a minute, so it must be well over that. */
export const LOST_MS = 3 * 60_000;
export const MAX_TESTS_PER_DEMO = 100;

const digest = (text: string) => createHash("sha256").update(text).digest("hex");

const ACTIVE: DemoRunStatus[] = ["running", "paused"];

/** Ends the demos that have been silent for too long. */
export const closeLostDemos = async (now = new Date(), client: DbClient = prisma) =>
  client.demoRun.updateMany({
    where: { status: { in: ACTIVE }, lastSignalAt: { lt: new Date(now.getTime() - LOST_MS) } },
    data: { status: "stopped", stopReason: "lost", endedAt: now },
  });

/** The token is shown only here. Every later message needs it, so nobody can end the demo of somebody else. */
export const startDemo = async (mode: DemoRunMode, now = new Date()) => {
  await closeLostDemos(now);
  const token = randomBytes(24).toString("hex");
  const run = await prisma.demoRun.create({
    data: { mode, status: "running", tokenHash: digest(token), startedAt: now, lastSignalAt: now },
  });
  return { id: run.id, token };
};

/** Finds the demo, locked until the end of the transaction, when the token is right. */
const ownDemo = async (tx: DbClient, id: number, token: string) => {
  await tx.$queryRaw`SELECT 1 FROM testschema.demo_run WHERE id = ${id} FOR UPDATE`;
  const run = await tx.demoRun.findUnique({ where: { id } });
  const right =
    run && timingSafeEqual(Buffer.from(run.tokenHash, "hex"), Buffer.from(digest(token), "hex"));
  if (!right) throw new HttpError(404, "demo not found"); // a wrong token looks the same
  return run;
};

const isActive = (status: DemoRunStatus) => ACTIVE.includes(status);

/** "I am still here", running or paused. A demo that only seemed to be gone goes on (the tab was asleep or came back). */
export const signalDemo = (
  id: number,
  token: string,
  status: "running" | "paused",
  now = new Date()
): Promise<{ status: DemoRunStatus }> =>
  prisma.$transaction(async (tx) => {
    const run = await ownDemo(tx, id, token);
    const cameBack = run.stopReason === "lost" || run.stopReason === "closed";
    if (!isActive(run.status) && !cameBack) throw new HttpError(409, "this demo has ended");
    await tx.demoRun.update({
      where: { id },
      data: { status, lastSignalAt: now, endedAt: null, stopReason: null },
    });
    return { status };
  });

export interface DemoTest {
  testCase: string;
  file: string;
  status: "passed" | "failed" | "skipped";
  startedAt: string; // ISO
  durationMs: number;
  errorMessage?: string | null;
}

const addTest = async (tx: DbClient, demoRunId: number, test: DemoTest) => {
  if ((await tx.demoTestRecord.count({ where: { demoRunId } })) >= MAX_TESTS_PER_DEMO) return;
  await tx.demoTestRecord.create({
    data: {
      demoRunId,
      testCase: test.testCase,
      file: test.file,
      status: test.status,
      startedAt: new Date(test.startedAt),
      durationMs: test.durationMs,
      errorMessage: test.status === "passed" ? null : shortError(test.errorMessage),
    },
  });
};

export const recordDemoTest = (id: number, token: string, test: DemoTest, now = new Date()) =>
  prisma.$transaction(async (tx) => {
    const run = await ownDemo(tx, id, token);
    if (!isActive(run.status)) throw new HttpError(409, "this demo has ended");
    await addTest(tx, id, test);
    await tx.demoRun.update({ where: { id }, data: { lastSignalAt: now } });
  });

/** The end. `test` is the one that was playing when the visitor stopped. Saying it again changes nothing. */
export const endDemo = (
  id: number,
  token: string,
  end: { status: "finished" | "failed" | "stopped"; reason?: DemoStopReason; test?: DemoTest },
  now = new Date()
): Promise<{ status: DemoRunStatus }> =>
  prisma.$transaction(async (tx) => {
    const run = await ownDemo(tx, id, token);
    if (!isActive(run.status)) return { status: run.status };
    if (end.test) await addTest(tx, id, end.test);
    await tx.demoRun.update({
      where: { id },
      data: {
        status: end.status,
        stopReason: end.status === "stopped" ? (end.reason ?? "button") : null,
        lastSignalAt: now,
        endedAt: now,
      },
    });
    return { status: end.status };
  });

/** Is a demo going on now? `playing` is the answer; the rest explains it. */
export const getDemoState = async (now = new Date()) => {
  await closeLostDemos(now);
  const shown = {
    id: true,
    mode: true,
    status: true,
    stopReason: true,
    startedAt: true,
    endedAt: true,
  } as const;
  const [active, latest] = await Promise.all([
    prisma.demoRun.findMany({
      where: { status: { in: ACTIVE } },
      select: shown,
      orderBy: { id: "desc" },
      take: 50,
    }),
    prisma.demoRun.findFirst({ select: shown, orderBy: { id: "desc" } }),
  ]);
  return { playing: active.length > 0, active, latest };
};
