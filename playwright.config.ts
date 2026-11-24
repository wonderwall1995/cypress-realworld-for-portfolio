import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const CI = !!process.env.CI;
const BASE_URL = `http://localhost:${process.env.PORT || "7201"}`;

// A numbered run (pnpm test:run): starter.spec.ts asks the number server for a run number and its fixtures
// first, and finisher.spec.ts tells it at the end that the run reached its end.
// Without TEST_RUN (one file, the demo, plain "pnpm test") there is no number and the tests use random values.
const NUMBERED = process.env.TEST_RUN === "1";
const RUN_FILES = ["starter.spec.ts", "finisher.spec.ts"]; // the first and the last step of a numbered run, not tests
// A run number belongs to a run of ALL tests: choosing files or titles is refused before a number is opened
// (no --reporter: it would replace tests/test-run-reporter.ts, which keeps the number alive and blocks a stopped run)
const ALLOWED = ["--output=", "--headed", "--list"];
const chosen = process.argv.slice(process.argv.indexOf("test") + 1);
if (
  NUMBERED &&
  process.argv.includes("test") &&
  chosen.some((arg) => !ALLOWED.some((allowed) => arg.startsWith(allowed)))
) {
  throw new Error(
    "pnpm test:run always runs every test. Use pnpm test to run a part (it opens no run number)."
  );
}
export const TEST_RUN_SERVER = process.env.TEST_RUN_SERVER || BASE_URL;
export const TEST_RUN_FILE = join(__dirname, "test-results", "test-run.json"); // git-ignored, emptied by every run
export const TEST_RESULTS_FILE = join(__dirname, "test-results", "test-run-results.jsonl"); // the same
// Every worker reads this config when it starts, after the starter has written the file
if (NUMBERED && existsSync(TEST_RUN_FILE)) {
  process.env.TEST_RUN_FIXTURES = JSON.stringify(
    JSON.parse(readFileSync(TEST_RUN_FILE, "utf8")).fixtures
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  // The Playwright default: a test file is named *.spec.ts (for example 000-demo-testing.spec.ts).
  // Shared code (common/), API tools (api/) and fixture code (fixture/) have no .spec in the name: tests import them, they are not tests.
  // testcode.template.ts is not a test either: it is the template of a new test file.
  timeout: 3 * 60_000, // the default time limit of one test: 3 minutes (Playwright's own default is 30 seconds)
  fullyParallel: false, // the app shares one PostgreSQL database, so run tests one at a time
  forbidOnly: CI,
  // a numbered run never retries: a user name belongs to one number, so a second try could not sign up again
  retries: CI && !NUMBERED ? 2 : 0,
  workers: 1,
  reporter: [
    CI ? ["github"] : ["list"],
    ["html", { open: "never" }],
    ...(NUMBERED ? ([["./tests/test-run-reporter.ts"]] as [string][]) : []),
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // A numbered run is Chrome only, and waits for the starter
  projects: NUMBERED
    ? [
        { name: "starter", testMatch: "starter.spec.ts", teardown: "finisher" },
        { name: "finisher", testMatch: "finisher.spec.ts" },
        {
          name: "chromium",
          testIgnore: RUN_FILES,
          dependencies: ["starter"],
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
      ].map((project) => ({ ...project, testIgnore: RUN_FILES })),
  // Starts the Vite frontend (PORT) and Express API (VITE_BACKEND_PORT) before the tests
  webServer: {
    command: "pnpm start",
    // Waits for the API too: "/api" goes through the Vite proxy, which answers 502 until Express is up
    url: `${BASE_URL}/api/checkAuth`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
