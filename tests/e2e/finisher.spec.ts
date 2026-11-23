import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { TEST_RUN_FILE, TEST_RUN_SERVER } from "../../playwright.config";

// 정식 실행(pnpm test:run)의 맨 끝에 한 번 도는 마무리다. 앞의 테스트가 실패했어도 돈다 (실패도 끝까지 돈 것이다).
// 사람이 멈추면 이 파일은 돌지 않고, 기록기(tests/test-run-reporter.ts)가 Blocked를 보낸다.
test("finisher: 이 번호를 끝까지 돌았다고 알린다", async ({ request }) => {
  test.skip(!existsSync(TEST_RUN_FILE), "번호를 받지 못해 마무리할 것이 없다");
  const run: { runNo: number; ready?: boolean } = JSON.parse(readFileSync(TEST_RUN_FILE, "utf8"));

  // starter가 끝까지 가지 못했으면 다른 테스트가 돌지 않은 것이므로 끝난 것이 아니라 Blocked다
  const event = run.ready ? "finish" : "block";
  const response = await request.post(`${TEST_RUN_SERVER}/api/testRuns/${run.runNo}/${event}`, {
    headers: { Authorization: `Bearer ${process.env.TEST_RUN_SECRET ?? ""}` },
    data: { platform: "web" },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).platformStatus).toBe(run.ready ? "finished" : "blocked");
});
