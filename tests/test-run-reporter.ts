/**
 * Watches a numbered run (pnpm test:run): a signal after every test, and block when the run is stopped midway.
 * The normal end is told by finisher.spec.ts, because a server that Playwright started is already down here.
 * Playwright's own reporter feature; it talks only to the number server.
 * It does not record results yet (code_result): that is the next step.
 */
import { existsSync, readFileSync, rmSync } from "fs";
import type { FullResult, Reporter } from "@playwright/test/reporter";
import { TEST_RUN_FILE, TEST_RUN_SERVER } from "../playwright.config";

const runNumber = (): number | undefined =>
  existsSync(TEST_RUN_FILE) ? JSON.parse(readFileSync(TEST_RUN_FILE, "utf8")).runNo : undefined;

const tell = async (runNo: number, event: "signal" | "block"): Promise<boolean> => {
  try {
    const response = await fetch(`${TEST_RUN_SERVER}/api/testRuns/${runNo}/${event}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.TEST_RUN_SECRET ?? ""}`,
      },
      body: JSON.stringify({ platform: "web" }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

class TestRunReporter implements Reporter {
  onBegin() {
    // the number of an older run must never be changed by this one
    rmSync(TEST_RUN_FILE, { force: true });
  }

  onTestEnd() {
    const runNo = runNumber();
    if (runNo !== undefined) void tell(runNo, "signal");
  }

  async onEnd(result: FullResult) {
    const runNo = runNumber();
    if (runNo === undefined) return console.log("[test run] no run number");

    const stopped = result.status === "interrupted" || result.status === "timedout";
    if (!stopped) return console.log(`[test run] number ${runNo}, ${result.status}`);
    const sent = await tell(runNo, "block");
    console.log(
      `[test run] number ${runNo} was stopped: ${sent ? "blocked" : "the server blocks it 10 minutes after the last signal"}`
    );
  }

  printsToStdio() {
    return false;
  }
}

export default TestRunReporter;
