import { expect, Page, test } from "@playwright/test";
import { expectNewBankAccount } from "../api/expect-bank-account";
import { randomBankAccountInput } from "../fixture/random-bank-account";

/**
 * 공통 코드: 은행 계좌 하나를 만든다. 만드는 일 전체를 한다.
 * 1) 화면의 은행 계좌 양식(/bankaccounts/new)으로 만든다. 계좌 정보는 무작위다.
 *    계좌가 만들어지면 앱이 계좌 목록(/bankaccounts)으로 보내므로, 주소로 성공을 판정한다.
 * 2) API로 그 계좌가 실제로 있고 금액이 0인지 확인한다.
 * 만든 계좌의 정보(API가 준 id 포함)를 돌려준다.
 */
export async function createBankAccount(page: Page) {
  return test.step("[common] createBankAccount", async () => {
    const account = randomBankAccountInput();

    await page.goto("/bankaccounts/new");
    await expect(page).toHaveURL("/bankaccounts/new");
    await page.getByTestId("bankaccount-bankName-input").locator("input").fill(account.bankName);
    await page
      .getByTestId("bankaccount-accountNumber-input")
      .locator("input")
      .fill(account.accountNumber);
    await page.getByTestId("bankaccount-submit").click();
    await expect(page).toHaveURL("/bankaccounts");

    const found = await expectNewBankAccount(page, account);
    return { ...account, id: found.id };
  });
}
