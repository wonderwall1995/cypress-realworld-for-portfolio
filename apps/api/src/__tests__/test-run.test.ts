// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { AddressInfo } from "net";
import { Server } from "http";
import { isValidAccountNumber, isValidPhoneNumber } from "@rwa/shared";
import prisma from "../prisma";
import { HttpError } from "../http-error";
import testRunRoutes from "../test-run-routes";
import {
  FIXTURE_RULES,
  makeFixturePeople,
  makeFixtureValues,
  partitionsOf,
  Person,
  usernameOf,
} from "../test-fixture-rules";
import { getLatestPublicFixtures, listRuns, reportRun, startRun } from "../test-run-db";
import { fixturePassword, getTestRunSecret, hasTestRunSecret } from "../test-run-secret";
import { emptyTestSchema } from "./db-setup/emptyTestSchema";

const SECRET = "s".repeat(40);
const start = (platform: "web" | "app", now?: Date) => startRun(platform, undefined, SECRET, now);
const minutes = (count: number) => new Date(Date.now() + count * 60_000);

beforeEach(emptyTestSchema);
afterAll(async () => {
  await emptyTestSchema();
  await prisma.$disconnect();
});

describe("run numbers", () => {
  it("the first start opens number 1, the other platform joins it with the same values", async () => {
    const web = await start("web");
    const app = await start("app");

    expect([web.runNo, web.opened]).toEqual([1, true]);
    expect([app.runNo, app.opened]).toEqual([1, false]);

    const different: string[] = [];
    for (const [testCase, items] of Object.entries(web.fixtures)) {
      for (const [item, value] of Object.entries(items)) {
        if (app.fixtures[testCase][item] !== value) different.push(item.split(".")[1]);
      }
    }
    expect(new Set(different)).toEqual(new Set(["username"])); // only the username differs
    expect(web.fixtures.transfer["A.username"]).toMatch(/1w$/);
    expect(app.fixtures.transfer["A.username"]).toBe(
      web.fixtures.transfer["A.username"].replace(/w$/, "a")
    );
  });

  it("a platform that has run the newest number opens the next one with new values", async () => {
    const first = await start("web");
    await reportRun(1, "web", "finish");
    const second = await start("web");

    expect(second.runNo).toBe(2);
    expect(second.fixtures.transfer["A.usernameBase"]).not.toBe(
      first.fixtures.transfer["A.usernameBase"]
    );
  });

  it("older numbers are closed: Web did 1, App did 2 and 3 -> Web's next is 3, not 2", async () => {
    await start("web"); // 1
    await start("app"); // joins 1
    expect((await start("app")).runNo).toBe(2);
    expect((await start("app")).runNo).toBe(3);

    expect((await start("web")).runNo).toBe(3);
  });

  it("two platforms that start at the same moment get one new number", async () => {
    await start("web");
    await start("app");

    const both = await Promise.all([start("web"), start("app")]);
    expect(both.map((run) => run.runNo)).toEqual([2, 2]);
    expect(both.filter((run) => run.opened)).toHaveLength(1);
    expect(both[0].fixtures.transfer.cycleDollars).toBe(both[1].fixtures.transfer.cycleDollars);
  });

  it("ten starts of one platform at the same moment: ten numbers, none skipped, none twice", async () => {
    const runs = await Promise.all(Array.from({ length: 10 }, () => start("web")));
    expect(runs.map((run) => run.runNo).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});

describe("finish, block and the 10-minute rule", () => {
  it("finish keeps the number open for the other platform", async () => {
    await start("web");
    expect(await reportRun(1, "web", "finish")).toEqual({
      runNo: 1,
      status: "open",
      platformStatus: "finished",
      finalResult: "pending",
    });
    expect((await start("app")).runNo).toBe(1);
  });

  it("one platform stops midway: the whole number is blocked, also when the other one had finished", async () => {
    await start("web");
    await reportRun(1, "web", "finish");
    await start("app");
    expect(await reportRun(1, "app", "block")).toMatchObject({
      status: "blocked",
      platformStatus: "blocked",
    });

    const [run] = await listRuns();
    expect(run.status).toBe("blocked");
    expect(run.platformRuns.map((p) => [p.platform, p.status])).toEqual([
      ["web", "finished"],
      ["app", "blocked"],
    ]);
  });

  it("a blocked number cannot be joined: the next start opens a new one", async () => {
    await start("web");
    await reportRun(1, "web", "block");
    expect((await start("app")).runNo).toBe(2);
  });

  it("no signal for more than 10 minutes blocks the number; exactly 10 minutes does not", async () => {
    const t0 = new Date();
    const at = (ms: number) => new Date(t0.getTime() + ms);
    await start("web", t0);

    expect((await listRuns(at(600_000)))[0].status).toBe("open");
    expect((await listRuns(at(600_001)))[0].status).toBe("blocked");
  });

  it("a signal starts the 10 minutes again", async () => {
    await start("web");
    await reportRun(1, "web", "signal", minutes(9));
    expect((await listRuns(minutes(18)))[0].status).toBe("open");
    expect((await listRuns(minutes(20)))[0].status).toBe("blocked");
  });

  it("a finished run is never blocked by time", async () => {
    await start("web");
    await reportRun(1, "web", "finish");
    expect((await listRuns(minutes(60)))[0].status).toBe("open");
  });

  it("a report that comes too late is refused (409), and the blocked state is saved", async () => {
    await start("web");
    await expect(reportRun(1, "web", "finish", minutes(11))).rejects.toMatchObject({ status: 409 });
    expect((await prisma.runProgress.findFirstOrThrow()).status).toBe("blocked");
    expect((await prisma.webTestReport.findFirstOrThrow()).result).toBe("blocked");
  });

  it("refuses a report of a platform that did not start the number (404) or has ended it (409)", async () => {
    await start("web");
    await expect(reportRun(1, "app", "signal")).rejects.toMatchObject({ status: 404 });
    await expect(reportRun(99, "web", "signal")).rejects.toMatchObject({ status: 404 });
    await reportRun(1, "web", "finish");
    await expect(reportRun(1, "web", "block")).rejects.toMatchObject({ status: 409 });
  });
});

describe("fixture values", () => {
  it("one number is one row of values and three people, and every test gets the same three", async () => {
    const { fixtures } = await start("web");
    expect(await prisma.testFixture.count()).toBe(1);
    const people = await prisma.testFixturePerson.findMany({ orderBy: { person: "asc" } });
    expect(people.map(({ person }) => person)).toEqual(["A", "B", "C"]);

    for (const [testCase, rule] of Object.entries(FIXTURE_RULES)) {
      for (const row of people) {
        const has = rule.people.includes(row.person);
        const of = (item: string) => fixtures[testCase][`${row.person}.${item}`];
        expect(of("firstName"), testCase).toBe(has ? row.firstName : undefined);
        expect(of("phoneNumber"), testCase).toBe(has ? row.phoneNumber : undefined);
        expect(of("partition.accountLength"), testCase).toBe(
          has ? String(row.partitionAccountLength) : undefined
        );
      }
    }
  });

  it("every test gets its own values, and no value column is left without a test", async () => {
    const { fixtures } = await start("web");
    const stored = await prisma.testFixture.findFirstOrThrow();
    const asked = Object.entries(FIXTURE_RULES).flatMap(([testCase, rule]) =>
      Object.entries(rule.values ?? {}).map(([item, column]) => {
        expect(fixtures[testCase][item], `${testCase}/${item}`).toBe(String(stored[column]));
        return column;
      })
    );
    expect(asked.sort()).toEqual(Object.keys(makeFixtureValues()).sort());
  });

  it("an open number gets only the values and people it does not have", async () => {
    const web = await start("web");
    await prisma.testFixture.update({ where: { runNo: 1 }, data: { transferCycleDollars: null } });
    await prisma.testFixturePerson.delete({ where: { runNo_person: { runNo: 1, person: "C" } } });
    const app = await start("app");
    expect(Number(app.fixtures.transfer.cycleDollars)).toBeGreaterThan(0);
    expect(app.fixtures.transfer["C.firstName"]).not.toBeUndefined();
    expect(app.fixtures.transfer["A.firstName"]).toBe(web.fixtures.transfer["A.firstName"]);
    expect(app.fixtures["transaction-detail"].comment).toBe(
      web.fixtures["transaction-detail"].comment
    );
  });

  it("every value fits its partition and the rules of the app (numbers 1 to 108)", () => {
    const korean = /^[가-힣]+$/;
    for (let runNo = 1; runNo <= 108; runNo += 1) {
      for (const row of makeFixturePeople(runNo)) {
        const partition = partitionsOf(runNo, row.person);
        expect(row.partitionUsername).toBe(partition.username);
        expect(row.partitionName).toBe(partition.name);
        expect(row.partitionPhone).toBe(partition.phone);
        expect(row.partitionAccountLength).toBe(partition.accountLength);

        const base = row.usernameBase;
        expect(base).toMatch(/[^0-9]$/); // digits follow
        if (partition.username === "korean") expect(base).toMatch(korean);
        if (partition.username === "english-digits") expect(base).toMatch(/^[a-z][0-9]{2}[a-z]+$/);
        if (partition.username === "mixed") expect(base).toMatch(/^[가-힣]+[0-9][a-z]+$/);

        const [min, max] = { one: [1, 1], usual: [2, 6], long: [20, 30] }[partition.name];
        for (const name of [row.firstName, row.lastName]) {
          expect(name.length).toBeGreaterThanOrEqual(min);
          expect(name.length).toBeLessThanOrEqual(max);
        }

        expect(isValidPhoneNumber(row.phoneNumber), row.phoneNumber).toBe(true);
        const phoneStart = { mobile: "010-", international: "+82 ", area: "(02) " };
        expect(row.phoneNumber.startsWith(phoneStart[partition.phone])).toBe(true);

        expect(isValidAccountNumber(row.accountNumber)).toBe(true);
        expect(row.accountNumber).toHaveLength(partition.accountLength);
      }
    }
  });

  it("no username of one number is a part of another one (the search finds parts)", () => {
    for (let runNo = 1; runNo <= 120; runNo += 1) {
      const people = makeFixturePeople(runNo);
      const usernames = Object.entries(FIXTURE_RULES).flatMap(([testCase, rule]) =>
        people
          .filter(({ person }) => rule.people.includes(person))
          .flatMap(({ usernameBase }) =>
            (["web", "app"] as const).map((platform) =>
              usernameOf(usernameBase, testCase, runNo, platform)
            )
          )
      );
      for (const one of usernames) {
        expect(usernames.filter((other) => other.includes(one))).toEqual([one]);
      }
    }
  });

  it("every test has its own code: two digits, and none only for transfer", () => {
    const codes = Object.entries(FIXTURE_RULES).map(([testCase, { code }]) => {
      expect(code, testCase).toMatch(testCase === "transfer" ? /^$/ : /^[0-9]{2}$/);
      return code;
    });
    expect(new Set(codes).size).toBe(codes.length);
    expect(usernameOf("o34ciat", "transfer", 6, "web")).toBe("o34ciat6w");
    expect(usernameOf("o34ciat", "transaction-detail", 6, "app")).toBe("o34ciat046a");
  });

  it("every run has all three-way partitions, and A meets every partition in any 5 numbers in a row", () => {
    const people: Person[] = ["A", "B", "C"];
    const seen = (
      runNos: number[],
      who: Person[],
      key: "username" | "name" | "phone" | "accountLength"
    ) => new Set(runNos.flatMap((n) => who.map((p) => partitionsOf(n, p)[key]))).size;

    for (let first = 1; first <= 108; first += 1) {
      for (const key of ["username", "name", "phone"] as const)
        expect(seen([first], people, key)).toBe(3);
      const five = [0, 1, 2, 3, 4].map((step) => first + step);
      for (const key of ["username", "name", "phone"] as const)
        expect(seen(five, ["A"], key)).toBe(3);
      expect(seen(five, ["A"], "accountLength")).toBe(4);
    }
  });
});

describe("the secret", () => {
  it("is closed without a value of at least 32 characters", () => {
    expect(getTestRunSecret({})).toBeUndefined();
    expect(getTestRunSecret({ TEST_RUN_SECRET: "x".repeat(31) })).toBeUndefined();
    expect(getTestRunSecret({ TEST_RUN_SECRET: ` ${"x".repeat(32)} ` })).toBe("x".repeat(32));
  });

  it("accepts only the exact header", () => {
    expect(hasTestRunSecret(`Bearer ${SECRET}`, SECRET)).toBe(true);
    for (const bad of [undefined, "", "Bearer ", SECRET, `Bearer ${SECRET}x`, `bearer ${SECRET}`]) {
      expect(hasTestRunSecret(bad, SECRET), String(bad)).toBe(false);
    }
  });

  it("gives the same password for the same person, another one for anyone else, and stores none", async () => {
    const of = (secret: string, runNo: number, testCase: string, person: string) =>
      fixturePassword(secret, runNo, testCase, person);
    expect(of(SECRET, 1, "transfer", "A")).toBe(of(SECRET, 1, "transfer", "A"));
    const all = [
      of(SECRET, 1, "transfer", "A"),
      of(SECRET, 2, "transfer", "A"),
      of(SECRET, 1, "deposit", "A"),
      of(SECRET, 1, "transfer", "B"),
      of("t".repeat(40), 1, "transfer", "A"),
    ];
    expect(new Set(all).size).toBe(all.length);

    const { fixtures } = await start("web");
    const password = fixtures.transfer["A.password"];
    expect(password).toHaveLength(24);
    const stored = JSON.stringify(await prisma.testFixture.findMany({ include: { people: true } }));
    expect(stored).not.toContain(password);
    expect(stored.toLowerCase()).not.toContain("password");
  });
});

describe("routes", () => {
  let server: Server;
  let base: string;
  const before = process.env.TEST_RUN_SECRET;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/testRuns", testRunRoutes);
    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) =>
      err instanceof HttpError ? res.status(err.status).json({ error: err.message }) : next(err)
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/testRuns`;
  });
  afterAll(() => {
    server.close();
  });
  beforeEach(() => {
    process.env.TEST_RUN_SECRET = SECRET;
  });
  afterEach(() => {
    if (before === undefined) delete process.env.TEST_RUN_SECRET;
    else process.env.TEST_RUN_SECRET = before;
  });

  const call = async (
    method: string,
    path: string,
    data?: unknown,
    secret: string | null = SECRET
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(secret === null ? {} : { authorization: `Bearer ${secret}` }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, json: (await response.json()) as any };
  };
  const PROTECTED: [string, string, unknown?][] = [
    ["POST", "", { platform: "web" }],
    ["GET", ""],
    ["GET", "/1/fixtures?platform=web"],
    ["POST", "/1/signal", { platform: "web" }],
    ["POST", "/1/finish", { platform: "web" }],
    ["POST", "/1/block", { platform: "web" }],
  ];

  it("without a secret on the server every protected route is closed (404), even with a header", async () => {
    delete process.env.TEST_RUN_SECRET;
    for (const [method, path, data] of PROTECTED) {
      expect((await call(method, path, data)).status, `${method} ${path}`).toBe(404);
    }
    expect(await prisma.testFixture.count()).toBe(0);
  });

  it("a missing or wrong secret is refused (401) and changes nothing", async () => {
    for (const secret of [null, "wrong", SECRET.slice(1)]) {
      for (const [method, path, data] of PROTECTED) {
        expect((await call(method, path, data, secret)).status, `${method} ${path}`).toBe(401);
      }
    }
    expect(await prisma.testFixture.count()).toBe(0);
  });

  it("start, join, signal, finish, list and read", async () => {
    const opened = await call("POST", "", { platform: "web", device: "chrome" });
    const joined = await call("POST", "", { platform: "app" });
    expect([opened.status, opened.json.runNo, joined.status, joined.json.runNo]).toEqual([
      201, 1, 200, 1,
    ]);

    expect((await call("POST", "/1/signal", { platform: "web" })).status).toBe(200);
    expect((await call("POST", "/1/finish", { platform: "web" })).json.platformStatus).toBe(
      "finished"
    );

    const list = await call("GET", "");
    expect(list.json.runs).toHaveLength(1);
    expect(list.json.runs[0].platformRuns[0]).toMatchObject({ platform: "web", device: "chrome" });

    const read = await call("GET", "/1/fixtures?platform=web");
    expect(read.json.fixtures).toEqual(opened.json.fixtures);
  });

  it("refuses wrong input (422) and a number that does not exist (404)", async () => {
    for (const platform of [undefined, "", "ios", 1]) {
      expect((await call("POST", "", { platform })).status, String(platform)).toBe(422);
    }
    expect((await call("GET", "/1/fixtures")).status).toBe(422);
    for (const runNo of ["0", "-1", "abc", "2147483648"]) {
      expect((await call("GET", `/${runNo}/fixtures?platform=web`)).status, runNo).toBe(422);
    }
    expect((await call("GET", "/99/fixtures?platform=web")).status).toBe(404);
    expect((await call("POST", "/99/finish", { platform: "web" })).status).toBe(404);
  });

  it("latest is for everyone and carries no username and no password", async () => {
    expect((await call("GET", "/latest", undefined, null)).json).toEqual({
      runNo: null,
      fixtures: {},
    });
    const started = await start("web");
    const latest = await call("GET", "/latest", undefined, null);

    expect(latest.status).toBe(200);
    expect(latest.json.runNo).toBe(1);
    expect(latest.json.fixtures.transfer["A.firstName"]).toBe(
      started.fixtures.transfer["A.firstName"]
    );
    const text = JSON.stringify(latest.json);
    for (const items of Object.values(started.fixtures)) {
      for (const [item, value] of Object.entries(items)) {
        if (/^[ABC]\.(username|usernameBase|password)$/.test(item)) {
          expect(text).not.toContain(value);
        }
      }
    }
    expect(await getLatestPublicFixtures()).toEqual(latest.json);

    delete process.env.TEST_RUN_SECRET; // also on a server without a secret
    expect((await call("GET", "/latest", undefined, null)).status).toBe(200);
  });
});
