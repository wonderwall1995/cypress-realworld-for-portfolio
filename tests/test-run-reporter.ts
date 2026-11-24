/**
 * Watches a numbered run (pnpm test:run): sends the result of every test and of the tools it called (which is a
 * signal too), and block when the run is stopped midway.
 * The normal end is told by finisher.spec.ts, because a server that Playwright started is already down here.
 * Playwright's own reporter feature; it talks only to the number server.
 */
import { existsSync, readFileSync, rmSync } from "fs";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { TEST_RESULTS_FILE, TEST_RUN_FILE, TEST_RUN_SERVER } from "../playwright.config";
import { keepResult, resultOf, sendResult } from "./test-run-results";

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
    rmSync(TEST_RESULTS_FILE, { force: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const runNo = runNumber();
    if (runNo === undefined) return;
    const outcome = resultOf(test, result);
    if (!outcome) return void tell(runNo, "signal");
    keepResult(outcome); // kept before it is sent: the finisher sends what did not arrive
    void sendResult(runNo, outcome);
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
