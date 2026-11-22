/**
 * The queue of demo tests. Every *.spec.ts file directly in tests/e2e is one test, in file name order (000, 001, ...).
 * CI runs the same files with the real Playwright: one file, two readers.
 * A test can import shared code from tests/e2e/common, API tools from tests/e2e/api and fixture code (the values that tests use) from tests/e2e/fixture.
 * Those files are shown as extra tabs of the test.
 */
// Vite reads the glob options in the source text, so they are written inline (not in a variable)
// @ts-ignore (import.meta.glob is a Vite feature)
const testFiles: Record<string, string> = import.meta.glob("../../../../tests/e2e/*.spec.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});
// the same files as modules (not text): importing one runs it, with "@playwright/test" replaced by the runner
// @ts-ignore
const testLoaders: Record<string, () => Promise<unknown>> = import.meta.glob("../../../../tests/e2e/*.spec.ts");
// every .ts file inside tests/e2e (also the sub folders): the IDE tab shows them as a snapshot of the folder
// @ts-ignore
const everyE2eFile: Record<string, string> = import.meta.glob("../../../../tests/e2e/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

// shared code (tests/e2e/common), API tools (tests/e2e/api) and fixture code (tests/e2e/fixture): tests import them, the demo shows them as tabs
// @ts-ignore
const sharedFiles: Record<string, string> = import.meta.glob(
  ["../../../../tests/e2e/common/*.ts", "../../../../tests/e2e/api/*.ts", "../../../../tests/e2e/fixture/*.ts"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

const REPO_PREFIX = "../../../../";

/** "test": a test of tests/e2e. "common": shared code of tests/e2e/common. "api": an API tool of tests/e2e/api. "fixture": fixture code of tests/e2e/fixture (it makes the values that tests use). */
export type DemoFileKind = "test" | "common" | "api" | "fixture";

export interface DemoFile {
  /** file name, for example signup.ts */
  name: string;
  /** what kind of code the file is, from the folder it lives in */
  kind: DemoFileKind;
  /** path from the repository root, for example tests/e2e/common/signup.ts */
  path: string;
  /** the file text, exactly as CI reads it */
  code: string;
}

export interface DemoTest extends DemoFile {
  /** loads the test file as a module: the tests it contains register themselves */
  load: () => Promise<unknown>;
  /** the test file itself first, then the shared files it imports from ./common/ and ./api/ */
  files: DemoFile[];
}

const kindOf = (key: string): DemoFileKind =>
  key.includes("/tests/e2e/api/")
    ? "api"
    : key.includes("/tests/e2e/common/")
      ? "common"
      : key.includes("/tests/e2e/fixture/")
        ? "fixture"
        : "test";

const toFile = (key: string, code: string): DemoFile => ({
  name: key.split("/").pop() as string,
  kind: kindOf(key),
  path: key.replace(REPO_PREFIX, ""),
  code,
});

// the path that an import line points to, for example tests/e2e/common/signup.ts
// ("./common/signup" from tests/e2e/000-auth.spec.ts, "../api/login" from tests/e2e/common/x.ts, "./signin" from tests/e2e/common/x.ts)
const resolveImport = (fromPath: string, specifier: string): string => {
  const parts = fromPath.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `${parts.join("/")}.ts`;
};

// The shared files (common code, API tools) that a file uses, also the ones that those files use (any depth).
const importedSharedFiles = (file: DemoFile): DemoFile[] => {
  const found = new Map<string, DemoFile>();
  const visit = (from: DemoFile) => {
    for (const match of from.code.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      const path = resolveImport(from.path, match[1]);
      const key = `${REPO_PREFIX}${path}`;
      if (!(key in sharedFiles) || found.has(path)) continue;
      const shared = toFile(key, sharedFiles[key]);
      found.set(path, shared);
      visit(shared);
    }
  };
  visit(file);
  // API tools, then the common code, then the fixture code (the tabs and the list show them in this order); the order of the imports stays inside a kind
  const rank = (shared: DemoFile) => (shared.kind === "api" ? 0 : shared.kind === "common" ? 1 : 2);
  return Array.from(found.values()).sort((a, b) => rank(a) - rank(b));
};

export const demoQueue: DemoTest[] = Object.keys(testFiles)
  .sort()
  .map((key) => {
    const file = toFile(key, testFiles[key]);
    return { ...file, load: testLoaders[key], files: [file, ...importedSharedFiles(file)] };
  });

/** The snapshot of the folder tests/e2e: every .ts file in it, in path order (the IDE tab shows it). */
export const e2eSnapshot: DemoFile[] = Object.keys(everyE2eFile)
  .sort()
  .map((key) => toFile(key, everyE2eFile[key]));

/** "idle": no demo. "running": the queue runs. "paused": the queue waits. "finished": the queue ended (or a step failed) and the code stays on screen. */
export type DemoState = "idle" | "running" | "paused" | "finished";
