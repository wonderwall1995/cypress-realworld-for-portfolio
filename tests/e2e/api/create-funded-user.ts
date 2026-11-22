import { expect, Page, test } from "@playwright/test";
import { randomBankAccountInput } from "../fixture/random-bank-account";
import { RandomUser } from "../fixture/random-user";
import { createAccountWithApi } from "./create-account";
import { loginWithApi } from "./login";

/** 돈이 든 은행 계좌 하나를 가진 사용자: 로그인에 쓰는 값(id 포함)과 그 계좌 */
export interface FundedUser {
  user: RandomUser & { id: string };
  account: { id: string; bankName: string; accountNumber: string };
}

/**
 * API 도구: 사용자 한 명을 통째로 준비한다. 가입 -> 로그인 -> 은행 계좌 만들기 -> 그 계좌에 입금(달러, 정수).
 * 만든 사용자와 계좌를 돌려준다 ({ user, account }).
 * 주의: 계좌를 만들려면 그 사람으로 로그인해야 하므로, 이 도구가 끝나면 브라우저의 로그인은 이 사용자다 (loginWithApi 참고).
 * 동작이 됐는지만 확인한다: 가입, 로그인, 계좌, 입금 중 하나라도 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function createFundedUserWithApi(page: Page, dollars: number): Promise<FundedUser> {
  return test.step("[api] createFundedUserWithApi", async () => {
    const user = await createAccountWithApi(page);
    await loginWithApi(page, user);
    const me = await page.request.get("/api/checkAuth");
    expect(me.ok()).toBeTruthy();
    const id: string = (await me.json()).user.id;

    const input = randomBankAccountInput();
    const created = await page.request.post("/api/bankAccounts", { data: input });
    expect(created.status()).toBe(200);
    const accountId: string = (await created.json()).account.id;

    const deposit = await page.request.post("/api/bankTransfers", {
      data: { bankAccountId: accountId, amount: dollars, type: "deposit" },
    });
    expect(deposit.status()).toBe(201);

    return { user: { ...user, id }, account: { id: accountId, ...input } };
  });
}
