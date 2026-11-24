/**
 * Results of a numbered run (testschema.web_test_record, app_test_record): one row for a test (kind "spec") and one for every tool it
 * called (common, api, fixture). The rules are in docs/fixture-prisma-guide.md 3.11 and 3.17.
 *
 * A runner may send the same result again (the answer can get lost): it is stored only once. The same test of the
 * same number, platform and attempt that started at the same moment is the same result.
 */
import { CodeKind, CodeResultStatus, TestPlatform } from "@prisma/client";
import prisma from "./prisma";
import { HttpError } from "./http-error";
import { recordsOf } from "./test-report-db";
import { changeRuns } from "./test-run-db";

export const MAX_ERROR_LENGTH = 300;
export const MAX_STEPS = 300;

interface CodeOutcome {
  name: string;
  file: string;
  status: CodeResultStatus;
  startedAt: string; // ISO
  durationMs: number;
  errorMessage?: string | null;
}

export interface TestOutcome extends CodeOutcome {
  testCase: string;
  attempt?: number;
  steps?: (CodeOutcome & { kind: Exclude<CodeKind, "spec"> })[];
}

// The colours that a terminal shows (ESC [ ... m) and other invisible characters
const COLOURS = /\p{Cc}\[[0-9;]*m/gu;
const INVISIBLE = /\p{Cc}/gu;

/** Only the first line, short: every table is shown in the DB tab of the demo, and the rest of an error can hold values. */
export const shortError = (message: string | null | undefined): string | null => {
  const first = (message ?? "").replace(COLOURS, "").trim().split("\n")[0];
  return first.replace(INVISIBLE, " ").trim().slice(0, MAX_ERROR_LENGTH) || null;
};

const rowOf = (outcome: CodeOutcome) => ({
  name: outcome.name,
  file: outcome.file,
  status: outcome.status,
  startedAt: new Date(outcome.startedAt),
  durationMs: outcome.durationMs,
  errorMessage: outcome.status === "failed" ? shortError(outcome.errorMessage) : null,
});

/**
 * Stores one test and the tools it called. It is a signal too (the run is alive).
 * Returns how many rows were written: 0 when this result was stored before.
 */
export const recordResult = async (
  runNo: number,
  platform: TestPlatform,
  outcome: TestOutcome,
  now = new Date()
): Promise<{ stored: number }> => {
  // the answer is returned, not thrown, so that blocking the dead runs is saved also when the result is refused
  const answer = await changeRuns(now, async (tx) => {
    const where = { runNo_platform: { runNo, platform } };
    const run = await tx.runProgress.findUnique({ where });
    if (!run) return new HttpError(404, "this platform has not started this run number");

    const records = recordsOf(tx, platform);
    const spec = {
      runNo,
      kind: "spec" as const,
      testCase: outcome.testCase,
      attempt: outcome.attempt ?? 1,
      ...rowOf(outcome),
    };
    const { kind, testCase, name, attempt, startedAt } = spec;
    const before = await records.findFirst({
      where: { runNo, kind, testCase, name, attempt, startedAt },
    });
    if (before) return { stored: 0 }; // sent again: also fine when the run has ended in the meantime
    if (run.status !== "running") {
      return new HttpError(409, `this run is not running any more (${run.status})`);
    }

    const { id: parentId } = await records.create({ data: spec });
    const steps = outcome.steps ?? [];
    await records.createMany({
      data: steps.map((step) => ({
        runNo,
        kind: step.kind,
        testCase,
        attempt,
        parentId,
        ...rowOf(step),
      })),
    });
    await tx.runProgress.update({ where, data: { lastSignalAt: now } });
    return { stored: 1 + steps.length };
  });
  if (answer instanceof HttpError) throw answer;
  return answer;
};

/** Every result of a number: the Web's, then the App's, each in the order they were stored. */
export const getRunResults = async (runNo: number) => {
  if (!(await prisma.testFixture.findUnique({ where: { runNo } }))) {
    throw new HttpError(404, "this run number does not exist");
  }
  const read = async (platform: TestPlatform) => {
    const rows = await recordsOf(prisma, platform).findMany({
      where: { runNo },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => ({ ...row, platform }));
  };
  return [...(await read("web")), ...(await read("app"))];
};
