/**
 * Vitest globalSetup: creates the test database if needed and applies all migrations.
 * `prisma migrate deploy` creates a missing database automatically.
 * If PostgreSQL is not running, only a warning is printed (the database tests will then fail clearly).
 */
import { execSync } from "child_process";
import { getTestDatabaseUrl } from "./testDb";

export default function setup() {
  try {
    execSync("pnpm exec prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() },
      stdio: "pipe",
    });
  } catch (err: any) {
    console.warn(
      "[test-db] could not prepare the test database (is PostgreSQL running? pnpm docker:up).\n" +
        String(err.stderr ?? err.message)
          .split("\n")
          .slice(0, 4)
          .join("\n")
    );
  }
}
