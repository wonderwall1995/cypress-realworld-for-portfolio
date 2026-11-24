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
const server = vi.hoisted(() => ({ fingerprint: "" }));
vi.mock("../server-fingerprint", () => ({
  get SERVER_FINGERPRINT() {
    return server.fingerprint;
  },
}));

const print = (letter: string) => letter.repeat(16);
beforeEach(async () => {
  server.fingerprint = print("1");
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
  it("start at 0.100, go up by one for new code, and code that comes back keeps its version", async () => {
    const seen = [];
    for (const letter of ["a", "a", "b", "c", "a"]) {
      seen.push((await start("web", { target: print(letter) })).versions.target);
    }
    expect(seen).toEqual(["0.100", "0.100", "0.101", "0.102", "0.100"]);
  });

  it("the server, the Web and the App have lines of their own", async () => {
    expect((await start("web", { target: print("a") })).versions).toEqual({
      server: "0.100",
      target: "0.100",
    });
    server.fingerprint = print("2");
    expect((await start("app", { target: print("a") })).versions).toEqual({
      server: "0.101",
      target: "0.100",
    });
    expect((await start("app", { target: print("b") })).versions).toEqual({
      server: "0.101",
      target: "0.101",
    });
  });

  it("after 0.999 comes 0.1000", async () => {
    await prisma.testVersion.create({
      data: { part: "web", version: "0.999", major: 0, minor: 999, fingerprint: print("a") },
    });
    expect((await start("web", { target: print("b") })).versions.target).toBe("0.1000");
    expect((await start("web", { target: print("c") })).versions.target).toBe("0.1001");
  });

  it("starts at the same moment make one version", async () => {
    const runs = await Promise.all([1, 2, 3, 4].map(() => start("web", { target: print("a") })));
    expect(new Set(runs.map((run) => run.versions.target))).toEqual(new Set(["0.100"]));
    expect(await prisma.testVersion.count({ where: { part: "web" } })).toBe(1);
  });

  it("a runner that tells nothing is welcome: its versions are empty", async () => {
    expect((await start("app")).versions).toEqual({ server: "0.100", target: null });
    const [run] = await listRuns();
    expect(run.platformRuns[0]).toMatchObject({ serverVersion: "0.100", targetVersion: null });
  });
});

describe("the final report", () => {
  const both = async (between: () => void = () => {}) => {
    await start("web", { target: print("a"), testCommit: "abcdef1", testDirty: false });
    await reportRun(1, "web", "finish");
    between();
    await start("app", { target: print("b"), testCommit: "1234567", testDirty: true });
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
    await both(() => (server.fingerprint = print("2")));
    expect(await finalRow()).toMatchObject({ same_server: false, app_server_version: "0.101" });
  });

  it("the server changed while one was running: not the same", async () => {
    await start("web");
    await reportRun(1, "web", "finish");
    await start("app");
    server.fingerprint = print("2");
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
