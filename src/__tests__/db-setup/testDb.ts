/**
 * Test database helpers (PostgreSQL / Prisma).
 *
 * Tests never touch the development database. DATABASE_URL from .env is rewritten
 * so that the database name ends with "_test" (rwa -> rwa_test).
 */
import "dotenv/config";

export const TEST_SUFFIX = "_test";

export function getTestDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set (check .env)");

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "");
  if (!name.endsWith(TEST_SUFFIX)) url.pathname = `/${name}${TEST_SUFFIX}`;
  return url.toString();
}

/** Point Prisma at the test database. Must run before PrismaClient is created. */
export function useTestDatabase(): string {
  const url = getTestDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

export function assertTestDatabase(url = process.env.DATABASE_URL ?? ""): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith(TEST_SUFFIX)) {
    throw new Error(
      `Refusing to touch database "${name}": its name must end with "${TEST_SUFFIX}"`
    );
  }
}
