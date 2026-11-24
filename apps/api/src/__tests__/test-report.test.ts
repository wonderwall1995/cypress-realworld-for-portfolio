// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "../prisma";
import { recordResult, TestOutcome } from "../test-result-db";
import { listRuns, reportRun, startRun } from "../test-run-db";
import { emptyTestSchema } from "./db-setup/emptyTestSchema";

beforeEach(emptyTestSchema);
afterAll(async () => {
  await emptyTestSchema();
  await prisma.$disconnect();
});

type Platform = "web" | "app";
type Status = "passed" | "failed" | "skipped";
const start = (platform: Platform) => startRun(platform, undefined, "s".repeat(40));

const code = { file: "a.ts", startedAt: "2026-11-24T01:00:00.000Z", durationMs: 1 };
const record = (
  platform: Platform,
  status: Status,
  tools: { common?: Status; api?: Status; fixture?: Status } = {},
  more: Partial<TestOutcome> = {}
) =>
  recordResult(1, platform, {
    ...code,
    testCase: "deposit",
    name: "2. deposit",
    status,
    steps: Object.entries(tools).map(([kind, toolStatus]) => ({
      ...code,
      kind: kind as "common" | "api" | "fixture",
      name: kind,
      status: toolStatus,
    })),
    ...more,
  });

const reportOf = async (platform: Platform) => {
  const report =
    platform === "web"
      ? await prisma.webTestReport.findUnique({ where: { runNo: 1 } })
      : await prisma.appTestReport.findUnique({ where: { runNo: 1 } });
  return report && [report.specOk, report.commonOk, report.apiOk, report.result];
};
const finalRow = async () =>
  (
    await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "SELECT * FROM testschema.final_test_report WHERE run_no = 1"
    )
  )[0];

const ok = { common: "passed", api: "passed" } as const;
const runAll = async (platform: Platform, status: Status = "passed") => {
  await record(platform, status, ok);
  return reportRun(1, platform, "finish");
};

describe("the report of one platform", () => {
  it("does not exist while the run goes on, and is written to that platform's table only", async () => {
    await start("web");
    await start("app");
    await record("web", "passed", ok);
    await reportRun(1, "web", "signal");
    expect(await reportOf("web")).toBeNull();

    await reportRun(1, "web", "finish");
    expect(await reportOf("web")).toEqual([true, true, true, "passed"]);
    expect(await reportOf("app")).toBeNull();
  });

  it.each([
    ["a failed test", "failed", ok, [false, true, true, "failed"]],
    [
      "a failed common tool",
      "failed",
      { common: "failed", api: "passed" },
      [false, false, true, "failed"],
    ],
    [
      "a failed api tool, also in a test that passed",
      "passed",
      { common: "passed", api: "failed" },
      [true, true, false, "failed"],
    ],
    ["no tools: empty, not failed", "passed", {}, [true, null, null, "passed"]],
    ["only a skipped test: nothing has passed", "skipped", {}, [null, null, null, "failed"]],
    [
      "a fixture tool has no column of its own",
      "passed",
      { fixture: "passed" },
      [true, null, null, "passed"],
    ],
  ] as [string, Status, object, unknown[]][])("%s", async (_what, status, tools, expected) => {
    await start("web");
    await record("web", status, tools);
    await reportRun(1, "web", "finish");
    expect(await reportOf("web")).toEqual(expected);
  });

  it("one failed test among passed ones fails the whole kind", async () => {
    await start("web");
    await record("web", "passed", ok);
    await record("web", "failed", ok, { testCase: "transfer", name: "3. transfer" });
    await reportRun(1, "web", "finish");
    expect(await reportOf("web")).toEqual([false, true, true, "failed"]);
  });

  it("a retried test counts by its last try", async () => {
    await start("web");
    await record("web", "failed", { common: "failed" }, { attempt: 1 });
    await record("web", "passed", { common: "passed" }, { attempt: 2 });
    await reportRun(1, "web", "finish");
    expect(await reportOf("web")).toEqual([true, true, null, "passed"]);
  });

  it("a finished run without any record has not passed", async () => {
    await start("web");
    await reportRun(1, "web", "finish");
    expect(await reportOf("web")).toEqual([null, null, null, "failed"]);
  });

  it("a blocked run has no verdicts, also when it died without a word", async () => {
    await start("web");
    await record("web", "passed", ok);
    await reportRun(1, "web", "block");
    expect(await reportOf("web")).toEqual([null, null, null, "blocked"]);

    await emptyTestSchema();
    await start("app");
    await listRuns(new Date(Date.now() + 11 * 60_000));
    expect(await reportOf("app")).toEqual([null, null, null, "blocked"]);
  });

  it("the number of another run does not count", async () => {
    await start("web");
    await runAll("web", "failed");
    await start("web"); // 2
    await recordResult(2, "web", { ...code, testCase: "deposit", name: "x", status: "passed" });
    await reportRun(2, "web", "finish");
    expect(
      (await prisma.webTestReport.findMany({ orderBy: { runNo: "asc" } })).map((r) => r.result)
    ).toEqual(["failed", "passed"]);
  });
});

describe("the final result", () => {
  it("is pending until both have ended", async () => {
    await start("web");
    expect((await finalRow()).final_result).toBe("pending");
    expect((await runAll("web")).finalResult).toBe("pending");
    await start("app");
    expect(await finalRow()).toMatchObject({
      web_result: "passed",
      app_result: null,
      decided_at: null,
    });

    expect((await runAll("app")).finalResult).toBe("passed");
    expect(await finalRow()).toMatchObject({
      web_spec_ok: true,
      app_spec_ok: true,
      web_result: "passed",
      app_result: "passed",
      final_result: "passed",
      decided_at: expect.any(Date),
    });
  });

  it.each([
    ["web", "app"],
    ["app", "web"],
  ] as [Platform, Platform][])(
    "only %s failed: each keeps its own result, the final one is failed",
    async (bad, good) => {
      await start(bad);
      await start(good);
      await runAll(bad, "failed");
      expect((await runAll(good)).finalResult).toBe("failed");
      expect((await reportOf(bad))![3]).toBe("failed");
      expect((await reportOf(good))![3]).toBe("passed");
    }
  );

  it("one platform stopped: blocked at once, the report of the other one stays", async () => {
    await start("web");
    await runAll("web");
    await start("app");
    expect((await reportRun(1, "app", "block")).finalResult).toBe("blocked");
    expect((await reportOf("web"))![3]).toBe("passed");
  });
});
