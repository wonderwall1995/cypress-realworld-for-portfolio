import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { TEST_RUN_FILE, TEST_RUN_SERVER } from "../../playwright.config";
import { keptResults, sendResult } from "../test-run-results";

// 정식 실행(pnpm test:run)의 맨 끝에 한 번 도는 마무리다. 앞의 테스트가 실패했어도 돈다 (실패도 끝까지 돈 것이다).
// 사람이 멈추면 이 파일은 돌지 않고, 기록기(tests/test-run-reporter.ts)가 Blocked를 보낸다.
test("finisher: 이 번호를 끝까지 돌았다고 알린다", async ({ request }) => {
  test.skip(!existsSync(TEST_RUN_FILE), "번호를 받지 못해 마무리할 것이 없다");
  const run: { runNo: number; ready?: boolean } = JSON.parse(readFileSync(TEST_RUN_FILE, "utf8"));

  // 기록기가 테스트마다 보낸 결과를 한 번 더 보낸다. 서버는 같은 결과를 한 번만 저장하므로, 빠진 것만 채워진다
  let missing = 0;
  for (const result of keptResults()) {
    if (!(await sendResult(run.runNo, result))) missing += 1;
  }

  // starter가 끝까지 가지 못했거나 저장하지 못한 결과가 있으면, 끝난 것이 아니라 Blocked다 (빠진 결과는 믿을 수 없다)
  const event = run.ready && missing === 0 ? "finish" : "block";
  const response = await request.post(`${TEST_RUN_SERVER}/api/testRuns/${run.runNo}/${event}`, {
    headers: { Authorization: `Bearer ${process.env.TEST_RUN_SECRET ?? ""}` },
    data: { platform: "web" },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).platformStatus).toBe(event === "finish" ? "finished" : "blocked");
  expect(missing).toBe(0);
});
