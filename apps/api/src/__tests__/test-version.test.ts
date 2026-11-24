// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "../prisma";
import { fingerprintOf } from "../source-fingerprint";
import { listRuns, reportRun, RunCode, startRun } from "../test-run-db";
import { emptyTestSchema } from "./db-setup/emptyTestSchema";

// the server of these tests can change its code
const server = vi.hoisted(() => ({ fingerprint: "", version: "" as string | undefined }));
vi.mock("../server-fingerprint", () => ({
  get SERVER_FINGERPRINT() {
    return server.fingerprint;
  },
  get SERVER_VERSION() {
    return server.version;
  },
}));

const print = (letter: string) => letter.repeat(16);
beforeEach(async () => {
  server.fingerprint = print("1");
  server.version = "0.100";
  await emptyTestSchema();
});
afterAll(async () => {
  await emptyTestSchema();
  await prisma.$disconnect();
});

const start = (platform: "web" | "app", code?: RunCode) =>
  startRun(platform, undefined, "s".repeat(40), new Date(), code);
const finalRow = async (runNo = 1) =>
  (
    await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM testschema.final_test_report WHERE run_no = ${runNo}`
    )
  )[0];

describe("versions", () => {
  const web = (version: string | undefined, letter: string | undefined) =>
    start("web", { targetVersion: version, target: letter && print(letter) });
  const stored = async () =>
    (await prisma.testVersion.findMany({ where: { part: "web" }, orderBy: { minor: "asc" } })).map(
      ({ version, fingerprint }) => [version, fingerprint[0]]
    );

  it("a version that was not seen before is stored with its fingerprint, and has no warning", async () => {
    for (const [version, letter] of [
      ["0.100", "a"],
      ["0.101", "b"],
      ["0.100", "a"],
      ["0.205", "c"],
    ]) {
      const { versions, warnings } = await web(version, letter);
      expect([versions, warnings]).toEqual([{ server: "0.100", target: version }, []]);
    }
    expect(await stored()).toEqual([
      ["0.100", "a"],
      ["0.101", "b"],
      ["0.205", "c"],
    ]);
  });

  it("the same version with other code: the run goes on, with a warning, and the first fingerprint stays", async () => {
    await web("0.100", "a");
    const { versions, warnings } = await web("0.100", "b");
    expect(versions.target).toBe("0.100");
    expect(warnings).toEqual([
      {
        part: "web",
        code: "code_changed",
        sent: "0.100",
        used: "0.100",
        message: expect.any(String),
      },
    ]);
    expect(await stored()).toEqual([["0.100", "a"]]);
  });

  it("the same code with another version: the older version is used, with a warning", async () => {
    await web("0.100", "a");
    const { versions, warnings } = await web("0.101", "a");
    expect(versions.target).toBe("0.100");
    expect(warnings).toMatchObject([{ code: "version_changed", sent: "0.101", used: "0.100" }]);
    expect(await stored()).toEqual([["0.100", "a"]]);
    const [run] = await listRuns();
    expect(run.platformRuns[0].targetVersion).toBe("0.100");
  });

  it("the same code in a new major gets the new version", async () => {
    await web("0.100", "a");
    expect(await web("1.0", "a")).toMatchObject({ versions: { target: "1.0" }, warnings: [] });
  });

  it("the server has its own line, and its warning comes with the start and with the end", async () => {
    await web("0.100", "a");
    server.fingerprint = print("2");
    expect(
      (await start("app", { targetVersion: "0.100", target: print("a") })).warnings
    ).toMatchObject([{ part: "server", code: "code_changed", sent: "0.100", used: "0.100" }]);
    expect((await reportRun(1, "app", "signal")).warnings).toEqual([]);
    expect((await reportRun(1, "app", "finish")).warnings).toMatchObject([
      { part: "server", code: "code_changed" },
    ]);
  });

  it("two parts can warn at the same time", async () => {
    await web("0.100", "a");
    server.version = "0.101";
    const { warnings } = await web("0.100", "b");
    expect(warnings.map(({ part, code }) => [part, code])).toEqual([
      ["server", "version_changed"],
      ["web", "code_changed"],
    ]);
  });

  it("a missing version or fingerprint is a warning, not an error", async () => {
    await web("0.100", "a");
    expect(await web(undefined, "a")).toMatchObject({
      versions: { target: "0.100" },
      warnings: [{ code: "version_missing", sent: null, used: "0.100" }],
    });
    expect(await web(undefined, "b")).toMatchObject({
      versions: { target: null },
      warnings: [{ code: "version_missing", sent: null, used: null }],
    });
    expect(await web("0.300", undefined)).toMatchObject({
      versions: { target: "0.300" },
      warnings: [{ code: "fingerprint_missing", sent: "0.300", used: "0.300" }],
    });
    server.version = undefined;
    expect((await start("app")).warnings).toMatchObject([
      { part: "server", code: "version_missing", used: "0.100" },
    ]);
    expect(await stored()).toEqual([["0.100", "a"]]);
  });

  it("starts at the same moment make one version", async () => {
    const runs = await Promise.all([1, 2, 3, 4].map(() => web("0.100", "a")));
    expect(new Set(runs.map((run) => run.versions.target))).toEqual(new Set(["0.100"]));
    expect(await stored()).toEqual([["0.100", "a"]]);
  });

  it("a runner that tells nothing is welcome: its version is empty, without a warning", async () => {
    const run = await start("app");
    expect([run.versions, run.warnings]).toEqual([{ server: "0.100", target: null }, []]);
    const [listed] = await listRuns();
    expect(listed.platformRuns[0]).toMatchObject({ serverVersion: "0.100", targetVersion: null });
  });
});

describe("the final report", () => {
  const both = async (between: () => unknown = () => {}) => {
    await start("web", {
      target: print("a"),
      targetVersion: "0.100",
      testCommit: "abcdef1",
      testDirty: false,
    });
    await reportRun(1, "web", "finish");
    between();
    await start("app", {
      target: print("b"),
      targetVersion: "0.100",
      testCommit: "1234567",
      testDirty: true,
    });
    await reportRun(1, "app", "finish");
  };

  it("shows what both worked with, and that the server was the same", async () => {
    await both();
    expect(await finalRow()).toMatchObject({
      same_server: true,
      web_version: "0.100",
      web_server_version: "0.100",
      web_server_version_end: "0.100",
      web_test_commit: "abcdef1",
      web_test_dirty: false,
      app_version: "0.100",
      app_server_version: "0.100",
      app_server_version_end: "0.100",
      app_test_commit: "1234567",
      app_test_dirty: true,
    });
  });

  it("the server changed between the two: not the same", async () => {
    await both(() => Object.assign(server, { fingerprint: print("2"), version: "0.101" }));
    expect(await finalRow()).toMatchObject({ same_server: false, app_server_version: "0.101" });
  });

  it("the server changed while one was running: not the same", async () => {
    await start("web");
    await reportRun(1, "web", "finish");
    await start("app");
    Object.assign(server, { fingerprint: print("2"), version: "0.101" });
    await reportRun(1, "app", "finish");
    expect(await finalRow()).toMatchObject({
      same_server: false,
      app_server_version: "0.100",
      app_server_version_end: "0.101",
    });
  });

  it("is empty while one has not ended, after a run that died, and for numbers without versions", async () => {
    await start("web");
    await reportRun(1, "web", "finish");
    expect((await finalRow()).same_server).toBeNull();
    await start("app");
    expect((await finalRow()).same_server).toBeNull();
    await listRuns(new Date(Date.now() + 11 * 60_000)); // the app died
    expect(await finalRow()).toMatchObject({ same_server: null, final_result: "blocked" });

    await both().catch(() => {}); // number 2
    await prisma.runProgress.updateMany({ data: { serverVersion: null, serverVersionEnd: null } });
    expect((await finalRow()).same_server).toBeNull();
  });
});

describe("the fingerprint", () => {
  const root = mkdtempSync(join(tmpdir(), "fingerprint-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const write = (file: string, content: string | Buffer) => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), content);
  };
  const now = () => fingerprintOf(root, ["src", "package.json"]);

  it("changes with the content, the name and a new file; not with line ends, tests or other folders", () => {
    write("package.json", "{}");
    write("src/a.ts", "one\ntwo\n");
    const first = now();
    expect(first).toMatch(/^[0-9a-f]{16}$/);

    write("src/a.ts", "one\r\ntwo\r\n");
    write("src/__tests__/a.test.ts", "test");
    write("src/node_modules/x/index.js", "x");
    write("docs/a.md", "text");
    expect(now()).toBe(first);

    write("src/b.ts", "");
    const withFile = now();
    write("src/a.ts", "one\ntwo!\n");
    const changed = now();
    rmSync(join(root, "src/b.ts"));
    write("src/c.ts", "");
    expect(new Set([first, withFile, changed, now()]).size).toBe(4);
  });

  it("sees every byte of a file that is not text", () => {
    write("src/p.png", Buffer.from([0xff, 0x00]));
    const one = now();
    write("src/p.png", Buffer.from([0xfe, 0x00]));
    expect(now()).not.toBe(one);
  });
});
