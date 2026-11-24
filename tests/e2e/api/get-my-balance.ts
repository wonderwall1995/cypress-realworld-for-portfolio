import { expect, Page, test } from "@playwright/test";

/**
 * API 도구: 지금 로그인한 사람의 잔액(센트)을 서버에서 읽어 돌려준다 (GET /api/checkAuth).
 * 잔액은 그 사람의 보이는 은행 계좌 금액의 합이다. 다른 사람의 잔액은 서버가 알려 주지 않으므로, 먼저 그 사람으로 로그인한다.
 * 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getMyBalanceWithApi(page: Page): Promise<number> {
  return test.step("[api] getMyBalanceWithApi", async () => {
    const response = await page.request.get("/api/checkAuth");
    expect(response.ok()).toBeTruthy();
    return (await response.json()).user.balance as number;
  });
}
