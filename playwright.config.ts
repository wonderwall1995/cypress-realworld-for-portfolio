import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const CI = !!process.env.CI;
const BASE_URL = `http://localhost:${process.env.PORT || "7201"}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // The Playwright default: a test file is named *.spec.ts (for example 000-demo-testing.spec.ts).
  // Shared code (common/), API tools (api/) and fixture code (fixture/) have no .spec in the name: tests import them, they are not tests.
  // testcode.template.ts is not a test either: it is the template of a new test file.
  timeout: 3 * 60_000, // the default time limit of one test: 3 minutes (Playwright's own default is 30 seconds)
  fullyParallel: false, // the app shares one PostgreSQL database, so run tests one at a time
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  reporter: CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  // Starts the Vite frontend (PORT) and Express API (VITE_BACKEND_PORT) before the tests
  webServer: {
    command: "pnpm start",
    // Waits for the API too: "/api" goes through the Vite proxy, which answers 502 until Express is up
    url: `${BASE_URL}/api/checkAuth`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
