import { DemoFile, DemoState, DemoTest } from "./queue";

/**
 * The steps of a test in the order they run, found by reading the test code (not by running it).
 * The footer uses it to show the testid of the current step.
 *
 * Limits (on purpose, to stay simple): a step is a line with getByTestId / getByRole / page.goto /
 * request.post / page.locator. A call of a function that is defined in a shared file (tests/e2e/common)
 * is replaced by the steps of that function. Loops and conditions are not followed.
 */
export interface PlanStep {
  /** path from the repository root, for example tests/e2e/common/signup.ts */
  path: string;
  /** line number in that file (starts at 1) */
  line: number;
  /** the data-testid the step works on, when it uses getByTestId("...") */
  testId?: string;
}

const LINE_BREAK = /\r?\n/;
const TEST_ID = /getByTestId\(\s*["'`]([^"'`]+)["'`]\s*\)/;
const STEP = /\b(getByTestId|getByRole|page\.goto|request\.(?:get|post|delete)|page\.locator|toHaveURL|toBeHidden|toContainText|toBeDisabled|toHaveCount)\b/;
const FUNCTION_START = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(/;
const MAX_DEPTH = 5;

interface FunctionBody {
  file: DemoFile;
  lines: string[];
  start: number;
  end: number;
}

const findFunctions = (files: DemoFile[]): Map<string, FunctionBody> => {
  const functions = new Map<string, FunctionBody>();
  for (const file of files) {
    const lines = file.code.split(LINE_BREAK);
    lines.forEach((text, start) => {
      const found = FUNCTION_START.exec(text);
      if (!found) return;
      // the function ends at the first line that is only a closing brace in the first column
      let end = lines.length - 1;
      for (let at = start + 1; at < lines.length; at += 1) {
        if (/^}\s*$/.test(lines[at])) {
          end = at;
          break;
        }
      }
      functions.set(found[1], { file, lines, start, end });
    });
  }
  return functions;
};

export const buildPlan = (test: DemoTest): PlanStep[] => {
  const functions = findFunctions(test.files);
  const plan: PlanStep[] = [];

  const walk = (file: DemoFile, lines: string[], from: number, to: number, depth: number) => {
    for (let at = from; at <= to; at += 1) {
      const text = lines[at];
      const trimmed = text.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

      const called = Array.from(functions.keys()).find(
        (name) => new RegExp(`\\b${name}\\(`).test(text) && !FUNCTION_START.test(text)
      );
      if (called && depth < MAX_DEPTH) {
        const body = functions.get(called)!;
        walk(body.file, body.lines, body.start + 1, body.end - 1, depth + 1);
        continue;
      }

      if (STEP.test(text)) {
        plan.push({ path: file.path, line: at + 1, testId: TEST_ID.exec(text)?.[1] });
      }
    }
  };

  const main = test.files[0];
  const lines = main.code.split(LINE_BREAK);
  walk(main, lines, 0, lines.length - 1, 0);
  return plan;
};

/**
 * The testid of the step that runs now (the footer shows it).
 * Nothing is shown while no demo runs or after it ended, or when the step has no testid.
 */
export const currentTestIdAt = (
  plan: PlanStep[],
  state: DemoState,
  path?: string,
  line?: number
): string | undefined => {
  if (state === "idle" || state === "finished") return undefined;
  return plan.find((step) => step.path === path && step.line === line)?.testId;
};
