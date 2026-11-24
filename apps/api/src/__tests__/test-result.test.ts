// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { AddressInfo } from "net";
import { Server } from "http";
import prisma from "../prisma";
import { HttpError } from "../http-error";
import testRunRoutes from "../test-run-routes";
import { getRunResults, MAX_ERROR_LENGTH, recordResult, shortError } from "../test-result-db";
import { reportRun, SIGNAL_LIMIT_MS, startRun } from "../test-run-db";
import { emptyTestSchema } from "./db-setup/emptyTestSchema";

const SECRET = "s".repeat(40);
const start = (platform: "web" | "app") => startRun(platform, undefined, SECRET);
const countOf = async (where = {}) => ({
  web: await prisma.webTestRecord.count({ where }),
  app: await prisma.appTestRecord.count({ where }),
});

beforeEach(emptyTestSchema);
afterAll(async () => {
  await emptyTestSchema();
  await prisma.$disconnect();
});

const step = (name: string, more = {}) => ({
  kind: "common" as const,
  name,
  file: "signin.ts",
  status: "passed" as const,
  startedAt: "2026-11-24T01:00:00.500Z",
  durationMs: 40,
  ...more,
});
const outcome = (more = {}) => ({
  testCase: "deposit",
  name: "2. deposit",
  file: "002-deposit.spec.ts",
  status: "passed" as const,
  startedAt: "2026-11-24T01:00:00.000Z",
  durationMs: 1200,
  steps: [step("signIn"), step("deposit", { kind: "api" as const })],
  ...more,
});

describe("results of a run", () => {
  it("stores the test and the tools it called, and the tools point to the test", async () => {
    await start("web");
    expect(await recordResult(1, "web", outcome())).toEqual({ stored: 3 });

    const rows = await getRunResults(1);
    expect(
      rows.map(({ kind, name, testCase, platform, attempt }) => [
        kind,
        name,
        testCase,
        platform,
        attempt,
      ])
    ).toEqual([
      ["spec", "2. deposit", "deposit", "web", 1],
      ["common", "signIn", "deposit", "web", 1],
      ["api", "deposit", "deposit", "web", 1],
    ]);
    expect(rows.map((row) => row.parentId)).toEqual([null, rows[0].id, rows[0].id]);
  });

  it("the same result sent again is stored once, also at the same moment and after the end", async () => {
    await start("web");
    const answers = await Promise.all([1, 2, 3].map(() => recordResult(1, "web", outcome())));
    expect(answers.map((answer) => answer.stored).sort()).toEqual([0, 0, 3]);

    await reportRun(1, "web", "finish");
    expect(await recordResult(1, "web", outcome())).toEqual({ stored: 0 });
    expect(await countOf()).toEqual({ web: 3, app: 0 });
  });

  it("another attempt, another start and the other platform are other results", async () => {
    await start("web");
    await start("app");
    await recordResult(1, "web", outcome());
    await recordResult(1, "web", outcome({ attempt: 2 }));
    await recordResult(1, "web", outcome({ startedAt: "2026-11-24T01:00:01.000Z" }));
    await recordResult(1, "app", outcome());
    expect(await countOf({ kind: "spec" })).toEqual({ web: 3, app: 1 });
  });

  it("the same tool called many times in one test is stored every time", async () => {
    await start("web");
    await recordResult(
      1,
      "web",
      outcome({ steps: [step("signIn"), step("signIn"), step("signIn")] })
    );
    expect(await countOf({ name: "signIn" })).toEqual({ web: 3, app: 0 });
  });

  it("refuses a run that was not started (404) or has ended (409)", async () => {
    await start("web");
    await expect(recordResult(1, "app", outcome())).rejects.toMatchObject({ status: 404 });
    await expect(recordResult(9, "web", outcome())).rejects.toMatchObject({ status: 404 });
    await reportRun(1, "web", "finish");
    await expect(recordResult(1, "web", outcome())).rejects.toMatchObject({ status: 409 });
    expect(await countOf()).toEqual({ web: 0, app: 0 });
  });

  it("a result is a signal: the run stays alive", async () => {
    await start("web");
    const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
    await recordResult(1, "web", outcome(), later(9));
    const { platformStatus } = await reportRun(1, "web", "signal", later(18));
    expect(platformStatus).toBe("running");
    expect(SIGNAL_LIMIT_MS).toBeLessThan(18 * 60_000);
  });

  it("keeps only the first line of an error, without colours, and no error for what passed", async () => {
    const red = "\u001b[31mError: expected 1\u001b[39m\n  at secret.ts\n  password: 1234";
    expect(shortError(red)).toBe("Error: expected 1");
    expect(shortError("x".repeat(1000))).toHaveLength(MAX_ERROR_LENGTH);
    expect(shortError("  \n ")).toBeNull();
    expect(shortError(undefined)).toBeNull();

    await start("web");
    await recordResult(
      1,
      "web",
      outcome({
        status: "failed",
        errorMessage: red,
        steps: [step("signIn", { errorMessage: "no" })],
      })
    );
    expect((await getRunResults(1)).map((row) => row.errorMessage)).toEqual([
      "Error: expected 1",
      null,
    ]);
  });
});

describe("the address", () => {
  let server: Server | undefined;
  afterEach(() => {
    server?.close();
    delete process.env.TEST_RUN_SECRET;
  });
  const send = async (body: object | undefined, secret = SECRET, path = "/1/results") => {
    process.env.TEST_RUN_SECRET = SECRET;
    const app = express();
    app.use(express.json());
    app.use("/testRuns", testRunRoutes);
    app.use((err: any, _req: any, res: express.Response, _next: any) =>
      res.status(err instanceof HttpError ? err.status : 500).json({ error: err.message })
    );
    server = await new Promise<Server>((resolve) => {
      const opened = app.listen(0, () => resolve(opened));
    });
    const response = await fetch(
      `http://localhost:${(server.address() as AddressInfo).port}/testRuns${path}`,
      {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
        body: body && JSON.stringify(body),
      }
    );
    server.close();
    return response;
  };
  const web = (more = {}) => ({ platform: "web", ...outcome(more) });

  it("201 the first time, 200 the second time, and it can be read", async () => {
    await start("web");
    expect((await send(web())).status).toBe(201);
    expect((await send(web())).status).toBe(200);
    const read = await send(undefined);
    expect(read.status).toBe(200);
    expect(((await read.json()) as { results: object[] }).results).toHaveLength(3);
  });

  it("needs the secret", async () => {
    await start("web");
    expect((await send(web(), "wrong")).status).toBe(401);
    expect((await send(undefined, "wrong")).status).toBe(401);
  });

  it.each([
    ["no platform", { platform: "pc" }],
    ["a label with other letters", { testCase: "Deposit!" }],
    ["no name", { name: " " }],
    ["an unknown status", { status: "ok" }],
    ["a wrong date", { startedAt: "yesterday" }],
    ["a negative time", { durationMs: -1 }],
    ["attempt 0", { attempt: 0 }],
    ["steps that are not a list", { steps: "signIn" }],
    ["a tool of the kind spec", { steps: [step("signIn", { kind: "spec" })] }],
    ["a tool without a name", { steps: [step("")] }],
    ["too many tools", { steps: Array.from({ length: 301 }, () => step("signIn")) }],
  ])("refuses %s (422)", async (_what, wrong) => {
    await start("web");
    expect((await send(web(wrong))).status).toBe(422);
    expect(await countOf()).toEqual({ web: 0, app: 0 });
  });

  it("accepts a label that only the App has, and the biggest allowed list of tools", async () => {
    await start("web");
    const steps = Array.from({ length: 300 }, () => step("createBankAccountsWithApi"));
    expect((await send(web({ testCase: "session-expired", steps }))).status).toBe(201);
    expect(await countOf()).toEqual({ web: 301, app: 0 });
  });
});
