import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const CI = !!process.env.CI;
const BASE_URL = `http://localhost:${process.env.PORT || "7201"}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the app shares a single lowdb database.json file
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
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
