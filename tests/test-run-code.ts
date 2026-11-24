/**
 * What a numbered run (pnpm test:run) works with: the commit of the test code, and the version and the fingerprint of
 * the Web screens. A person writes the version (apps/web/VERSION); the server compares it with the fingerprint. Not in tests/e2e/fixture: the demo in the browser
 * loads every file there, and this one needs Node.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { fingerprintOf } from "../apps/api/src/source-fingerprint";

const ROOT = join(__dirname, "..");
const WEB_SOURCES = [
  "apps/web/index.html",
  "apps/web/package.json",
  "apps/web/public",
  "apps/web/src",
  "apps/web/vite.config.ts",
  "packages/shared/src",
];
const TEST_SOURCES = ["tests", "playwright.config.ts"];

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 15_000 }).trim();

export interface RunCode {
  testCommit?: string;
  /** true: the test code has changes that are not committed */
  testDirty?: boolean;
  target: string;
  targetVersion?: string;
}

const webVersion = (): string | undefined => {
  try {
    return readFileSync(join(ROOT, "apps/web/VERSION"), "utf8").trim() || undefined;
  } catch {
    return undefined; // the server answers with a warning
  }
};

export const runCode = (): RunCode => {
  const screens = { target: fingerprintOf(ROOT, WEB_SOURCES), targetVersion: webVersion() };
  try {
    return {
      testCommit: git("rev-parse", "HEAD"),
      testDirty: git("status", "--porcelain", "--", ...TEST_SOURCES) !== "",
      ...screens,
    };
  } catch {
    return screens; // no git here: the run goes on, the commit stays empty
  }
};
