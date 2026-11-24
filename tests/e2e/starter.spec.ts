import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { TEST_RUN_FILE, TEST_RUN_SERVER } from "../../playwright.config";
import { runCode } from "../test-run-code";

// 정식 실행(pnpm test:run)에서 맨 먼저 한 번 도는 준비 테스트다. 실패하면 나머지 테스트는 돌지 않는다.
// 시험 파일이 아니므로 공통 머리말을 두지 않고, 시연 목록에도 나오지 않는다 (번호로 시작하는 파일만 나온다).
test("starter: 실행 번호와 Fixture를 받고, 번호 기능이 맞게 동작하는지 점검한다", async ({
  request,
}) => {
  const headers = { Authorization: `Bearer ${process.env.TEST_RUN_SECRET ?? ""}` };
  const url = (path = "") => `${TEST_RUN_SERVER}/api/testRuns${path}`;

  // 1) 비밀 값이 없으면 열리지 않는다
  const closed = await request.post(url(), { data: { platform: "web" } });
  expect(closed.status()).toBe(401);

  // 2) 번호를 열거나 합류하고 값을 받는다. 어떤 코드로 도는지도 알린다 (서버가 버전을 매긴다)
  const started = await request.post(url(), {
    headers,
    data: { platform: "web", device: "chrome", code: runCode() },
  });
  expect([200, 201]).toContain(started.status());
  const run: {
    runNo: number;
    opened: boolean;
    versions: { server: string; target: string };
    fixtures: Record<string, Record<string, string>>;
  } = await started.json();

  // 3) 받은 번호를 먼저 적어 둔다: 아래 점검이 실패해도 끝날 때 이 번호를 마무리할 수 있다
  mkdirSync(dirname(TEST_RUN_FILE), { recursive: true });
  writeFileSync(TEST_RUN_FILE, JSON.stringify(run));

  // 4) 점검: 이 번호는 가장 최신이고 Web이 실행 중이다
  const { runs } = await (await request.get(url(), { headers })).json();
  expect(runs[0].runNo).toBe(run.runNo);
  expect(runs[0].platformRuns).toContainEqual(
    expect.objectContaining({
      platform: "web",
      status: "running",
      serverVersion: run.versions.server,
      targetVersion: run.versions.target,
    })
  );

  // 5) 점검: 다시 읽어도 같은 값이다
  const again = await request.get(url(`/${run.runNo}/fixtures?platform=web`), { headers });
  expect((await again.json()).fixtures).toEqual(run.fixtures);

  // 6) 점검: 누구나 읽는 값에는 아이디와 비밀번호가 없다
  const latest = JSON.stringify(await (await request.get(url("/latest"))).json());
  expect(latest).not.toContain(run.fixtures.transfer["A.usernameBase"]);
  expect(latest).not.toContain(run.fixtures.transfer["A.password"]);

  // 7) 준비가 끝났다: 이제 다른 테스트가 돈다 (finisher가 이 표시를 본다)
  writeFileSync(TEST_RUN_FILE, JSON.stringify({ ...run, ready: true }));
});
