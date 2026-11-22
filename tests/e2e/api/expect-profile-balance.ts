import { expect, Page, test } from "@playwright/test";
import { getBankAccounts } from "./get-bank-accounts";

/**
 * API 도구: 내 프로필의 잔액이 내 은행 계좌 금액의 합과 같은지 판정한다. 돈이 움직인 뒤마다 지켜져야 하는 규칙이다.
 * - 계좌 금액: GET /api/bankAccounts 의 balance를 모두 더한다.
 * - 프로필 잔액: GET /api/checkAuth 의 user.balance.
 * 금액은 센트다. 다르면 이 도구를 부른 줄에서 테스트가 멈춘다. 확인한 합계(센트)를 돌려준다.
 * 화면 판정은 이 도구가 하지 않는다: spec 에서 돌려받은 합계로 expectProfileBalanceOnScreen 을 이어서 부른다.
 */
export async function expectProfileBalanceIsAccountSumWithApi(page: Page): Promise<number> {
  return test.step("[api] expectProfileBalanceIsAccountSumWithApi", async () => {
    const accounts = await getBankAccounts(page);
    const sumCents = accounts.reduce((sum, account) => sum + account.balance, 0);

    const response = await page.request.get("/api/checkAuth");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.user.balance).toBe(sumCents);

    return sumCents;
  });
}
