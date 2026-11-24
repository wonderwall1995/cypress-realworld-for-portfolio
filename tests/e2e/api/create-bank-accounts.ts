import { expect, Page, test } from "@playwright/test";
import { randomBankAccountInput } from "../fixture/random-bank-account";
import { getBankAccounts } from "./get-bank-accounts";

/**
 * API 도구: 은행 계좌가 모두 total개가 될 때까지, 모자란 만큼 한꺼번에 만든다 (POST /api/bankAccounts).
 * 화면의 로그인(쿠키)을 그대로 쓰므로 page.request로 부른다.
 * 은행 이름은 "테스트 은행 NN" (NN은 몇 번째 계좌인지: 01, 02, ... 60), 계좌 번호는 무작위다.
 * 하나라도 만들어지지 않으면(200이 아니면) 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function createBankAccountsWithApi(page: Page, total: number) {
  return test.step("[api] createBankAccountsWithApi", async () => {
    const accounts = await getBankAccounts(page);
    for (let count = accounts.length; count < total; count += 1) {
      const number = String(count + 1).padStart(2, "0");
      const response = await page.request.post("/api/bankAccounts", {
        data: {
          bankName: `테스트 은행 ${number}`,
          accountNumber: randomBankAccountInput().accountNumber,
        },
      });
      expect(response.status()).toBe(200);
    }
  });
}
