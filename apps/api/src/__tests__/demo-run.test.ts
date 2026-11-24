// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { AddressInfo } from "net";
import { Server } from "http";
import prisma from "../prisma";
import { HttpError } from "../http-error";
import {
  closeLostDemos,
  endDemo,
  getDemoState,
  LOST_MS,
  MAX_TESTS_PER_DEMO,
  recordDemoTest,
  signalDemo,
  startDemo,
} from "../demo-run-db";
import demoRunRoutes, { MAX_STARTS } from "../demo-run-routes";
import { assertTestDatabase } from "./db-setup/testDb";

const empty = async () => {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE testschema.demo_test_record, testschema.demo_run RESTART IDENTITY CASCADE"
  );
};
beforeEach(empty);
afterAll(async () => {
  await empty();
  await prisma.$disconnect();
});

const test = (more = {}) => ({
  testCase: "transfer",
  file: "003-transfer.spec.ts",
  status: "passed" as "passed" | "failed" | "skipped",
  startedAt: "2026-11-24T01:00:00.000Z",
  durationMs: 1200,
  ...more,
});
const only = () => prisma.demoRun.findFirstOrThrow({ orderBy: { id: "desc" } });
const later = (ms: number) => new Date(Date.now() + ms);

describe("a demo", () => {
  it("is going on from its start to its end", async () => {
    expect(await getDemoState()).toEqual({ playing: false, active: [], latest: null });

    const { id, token } = await startDemo("all");
    expect((await getDemoState()).playing).toBe(true);
    await recordDemoTest(id, token, test());
    await endDemo(id, token, { status: "finished" });

    const state = await getDemoState();
    expect(state).toMatchObject({ playing: false, active: [], latest: { id, status: "finished" } });
    expect(state.latest!.endedAt).toBeInstanceOf(Date);
  });

  it("stopped with the button: not going on, and the test that was playing is skipped", async () => {
    const { id, token } = await startDemo("partial");
    await endDemo(id, token, {
      status: "stopped",
      reason: "button",
      test: test({ status: "skipped", errorMessage: "방문자가 시연을 중지했습니다" }),
    });
    expect(await only()).toMatchObject({
      mode: "partial",
      status: "stopped",
      stopReason: "button",
    });
    expect((await getDemoState()).playing).toBe(false);
    expect(await prisma.demoTestRecord.findMany()).toMatchObject([
      {
        demoRunId: id,
        testCase: "transfer",
        status: "skipped",
        errorMessage: "방문자가 시연을 중지했습니다",
      },
    ]);
  });

  it("paused is still going on", async () => {
    const { id, token } = await startDemo("all");
    await signalDemo(id, token, "paused");
    expect(await getDemoState()).toMatchObject({
      playing: true,
      active: [{ id, status: "paused" }],
    });
  });

  it("silent for too long: lost, and not going on", async () => {
    const { id, token } = await startDemo("all");
    await closeLostDemos(later(LOST_MS - 1000));
    expect((await only()).status).toBe("running");

    expect(await getDemoState(later(LOST_MS + 1000))).toMatchObject({
      playing: false,
      latest: { id, status: "stopped", stopReason: "lost" },
    });
    // it only seemed to be gone: its tab was asleep
    await signalDemo(id, token, "running", later(LOST_MS + 2000));
    expect(await only()).toMatchObject({ status: "running", stopReason: null, endedAt: null });
  });

  it("a closed page that comes back goes on; a demo that was stopped or has ended does not", async () => {
    const closed = await startDemo("all");
    await endDemo(closed.id, closed.token, { status: "stopped", reason: "closed" });
    expect((await getDemoState()).playing).toBe(false);
    await signalDemo(closed.id, closed.token, "running");
    expect((await getDemoState()).playing).toBe(true);

    for (const end of [
      { status: "stopped", reason: "button" },
      { status: "finished" },
      { status: "failed" },
    ] as const) {
      const { id, token } = await startDemo("all");
      await endDemo(id, token, end);
      await expect(signalDemo(id, token, "running")).rejects.toMatchObject({ status: 409 });
      await expect(recordDemoTest(id, token, test())).rejects.toMatchObject({ status: 409 });
      // said again (the answer got lost): the first end stays
      expect(await endDemo(id, token, { status: "failed" })).toEqual({ status: end.status });
    }
  });

  it("nobody else can end it", async () => {
    const { id } = await startDemo("all");
    const other = await startDemo("all");
    const wrong = { status: 404 };
    await expect(endDemo(id, other.token, { status: "stopped" })).rejects.toMatchObject(wrong);
    await expect(signalDemo(id, "0".repeat(48), "running")).rejects.toMatchObject(wrong);
    await expect(recordDemoTest(999, other.token, test())).rejects.toMatchObject(wrong);
    expect((await getDemoState()).active).toHaveLength(2);
  });

  it("keeps the first line of an error, none for what passed, and not endless tests", async () => {
    const { id, token } = await startDemo("all");
    await recordDemoTest(id, token, test({ status: "failed", errorMessage: "first\nsecond" }));
    await recordDemoTest(id, token, test({ errorMessage: "nothing" }));
    const rows = await prisma.demoTestRecord.findMany({ orderBy: { id: "asc" } });
    expect(rows.map((row) => row.errorMessage)).toEqual(["first", null]);

    for (let more = 2; more < MAX_TESTS_PER_DEMO + 3; more += 1)
      await recordDemoTest(id, token, test());
    expect(await prisma.demoTestRecord.count()).toBe(MAX_TESTS_PER_DEMO);
  });
});

describe("the addresses", () => {
  let server: Server | undefined;
  afterEach(() => void server?.close());
  const open = async () => {
    const app = express();
    app.use(express.json());
    app.use("/demoRuns", demoRunRoutes);
    app.use((err: any, _req: any, res: express.Response, _next: any) =>
      res.status(err instanceof HttpError ? err.status : 500).json({ error: err.message })
    );
    server = await new Promise<Server>((resolve) => {
      const opened = app.listen(0, () => resolve(opened));
    });
    const base = `http://localhost:${(server.address() as AddressInfo).port}/demoRuns`;
    return async (path: string, message?: object) => {
      const response = await fetch(base + path, {
        method: message ? "POST" : "GET",
        headers: { "content-type": "application/json" },
        body: message && JSON.stringify(message),
      });
      const text = await response.text();
      return { status: response.status, json: text.startsWith("{") ? JSON.parse(text) : undefined };
    };
  };

  it("start, signal, test, end; the answer about the state never holds the token", async () => {
    const call = await open();
    const { status, json } = await call("", { mode: "all" });
    expect(status).toBe(201);
    const { id, token } = json;
    expect((await call(`/${id}/signal`, { token, status: "paused" })).status).toBe(200);
    expect((await call(`/${id}/tests`, { token, ...test() })).status).toBe(204);
    const state = await call("/current");
    expect(state.json.playing).toBe(true);
    expect(JSON.stringify(state.json)).not.toMatch(/token/i);
    const end = { token, status: "stopped", reason: "button", test: test({ status: "skipped" }) };
    expect((await call(`/${id}/end`, end)).json).toEqual({ status: "stopped" });
    expect((await call("/current")).json.playing).toBe(false);
    expect((await call(`/${id}/tests`, { token, ...test() })).status).toBe(409);
  });

  it("refuses wrong values (422) and changes nothing", async () => {
    const call = await open();
    const { id, token } = (await call("", { mode: "all" })).json;
    const wrong: [string, object][] = [
      ["", { mode: "some" }],
      [`/${id}/signal`, { token, status: "stopped" }],
      [`/${id}/signal`, { token: "x", status: "running" }],
      [`/${id}/tests`, { token, ...test({ testCase: "Transfer!" }) }],
      [`/${id}/tests`, { token, ...test({ durationMs: -1 }) }],
      [`/${id}/end`, { token, status: "running" }],
      [`/${id}/end`, { token, status: "stopped", reason: "lost" }],
      [`/${id}/end`, { token, status: "stopped", test: { testCase: "transfer" } }],
      ["/abc/end", { token, status: "stopped" }],
    ];
    for (const [path, message] of wrong) {
      expect((await call(path, message)).status, `${path} ${JSON.stringify(message)}`).toBe(422);
    }
    expect((await only()).status).toBe("running");
    expect((await call(`/${id}/end`, { token, status: "finished" })).status).toBe(200);
  });

  it("one address can start only a few in a while", async () => {
    const call = await open();
    let started = 0;
    for (let count = 0; count < MAX_STARTS + 2; count += 1) {
      if ((await call("", { mode: "all" })).status === 201) started += 1;
    }
    expect(started).toBeLessThanOrEqual(MAX_STARTS);
    expect((await call("", { mode: "all" })).status).toBe(429);
    expect((await call("/current")).status).toBe(200);
  });
});
