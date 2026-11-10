import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/__tests__/db-setup/env.ts"],
    globalSetup: "./src/__tests__/db-setup/global.ts",
    fileParallelism: false, // run test files one at a time: they share one test database
  },
});
