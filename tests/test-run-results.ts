/**
 * The results of a numbered run on their way to the number server.
 * Every result is written to a file first, so a result that could not be sent is not lost: the finisher sends all of
 * them once more (the server stores each one only once) before it says that the run has reached its end.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { basename, dirname } from "path";
import type { TestCase, TestResult, TestStep } from "@playwright/test/reporter";
import { TEST_RESULTS_FILE, TEST_RUN_SERVER } from "../playwright.config";

// The title of a tool's step: "[common] signIn"
const TOOL_STEP = /^\[(common|api|fixture)\] (.+)$/;

/** The label of a spec is its file name: 002-deposit.spec.ts -> deposit. Undefined: not a numbered spec. */
export const labelOf = (file: string): string | undefined =>
  /^\d{3}-(.+)\.spec\.ts$/.exec(basename(file))?.[1];

const toolStepsOf = (steps: TestStep[]): object[] =>
  steps.flatMap((step) => {
    const inside = toolStepsOf(step.steps); // a tool can call another tool
    const tool = step.category === "test.step" ? TOOL_STEP.exec(step.title) : null;
    if (!tool) return inside;
    const own = {
      kind: tool[1],
      name: tool[2],
      file: basename(step.location?.file ?? "unknown"),
      status: step.error ? "failed" : "passed",
      startedAt: step.startTime.toISOString(),
      durationMs: Math.max(0, Math.round(step.duration)),
      errorMessage: step.error?.message?.slice(0, 2000),
    };
    return [own, ...inside];
  });

/** One test as the server stores it. Undefined: this test is not recorded (the starter, the finisher, a stopped test). */
export const resultOf = (test: TestCase, result: TestResult): object | undefined => {
  const testCase = labelOf(test.location.file);
  if (!testCase || result.status === "interrupted") return undefined;
  return {
    platform: "web",
    testCase,
    name: test.title,
    file: basename(test.location.file),
    attempt: result.retry + 1,
    status: result.status === "timedOut" ? "failed" : result.status,
    startedAt: result.startTime.toISOString(),
    durationMs: Math.max(0, Math.round(result.duration)),
    errorMessage: result.error?.message?.slice(0, 2000),
    steps: toolStepsOf(result.steps),
  };
};

export const keepResult = (result: object) => {
  mkdirSync(dirname(TEST_RESULTS_FILE), { recursive: true });
  appendFileSync(TEST_RESULTS_FILE, `${JSON.stringify(result)}\n`);
};

export const keptResults = (): object[] =>
  existsSync(TEST_RESULTS_FILE)
    ? readFileSync(TEST_RESULTS_FILE, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line))
    : [];

/** True when the server has the result now (stored, or stored before). */
export const sendResult = async (runNo: number, result: object): Promise<boolean> => {
  try {
    const response = await fetch(`${TEST_RUN_SERVER}/api/testRuns/${runNo}/results`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.TEST_RUN_SECRET ?? ""}`,
      },
      body: JSON.stringify(result),
    });
    return response.ok;
  } catch {
    return false;
  }
};
