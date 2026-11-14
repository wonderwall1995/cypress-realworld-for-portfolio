import { test, expect } from "@playwright/test";
import { createBankAccountsWithApi } from "./api/create-bank-accounts";
import { getBankAccounts } from "./api/get-bank-accounts";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { createBankAccount } from "./common/create-bank-account";
import { goToMain } from "./common/go-to-main";

const MIN_BANK_ACCOUNTS = 3; // 입금 시험을 하려면 계좌가 이만큼은 있어야 한다
const MAX_BANK_ACCOUNTS = 60; // 앱이 한 사용자에게 허용하는 계좌 수의 최대

test("1. 은행 계좌: 만들기, 최대 60개 경계, 삭제(숨김), 하드 삭제를 시험한다", async ({ page, request }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page, request);

  // 페이지 확인: 지금 화면이 Main(주소 /)이다
  await expect(page).toHaveURL("/");

  // 은행 계좌 목록 화면에 계좌가 n개 보이는지 확인한다
  const expectListCount = async (count: number) => {
    await page.goto("/bankaccounts");
    await expect(page.locator('[data-testid^="bankaccount-list-item-"]')).toHaveCount(count);
  };

  // 화면에서 계좌 하나를 삭제한다. 앱의 삭제는 지우는 것이 아니라 숨기는 것(visible을 끔)이다
  const deleteInUi = async (accountId: string) => {
    await page.goto("/bankaccounts");
    await page.locator(`[data-testid="bankaccount-list-item-${accountId}"] [data-testid="bankaccount-delete"]`).click();
    await expect(page.getByTestId(`bankaccount-list-item-${accountId}`)).toBeHidden();
  };

  // 1) 만들기: 화면으로 계좌를 3개까지 만든다 (3개 이상이면 건너뜀)
  //    계좌 하나를 만들 때마다 그 계좌가 실제로 있고 금액이 0인지 API로 확인한다 (공통 코드가 한꺼번에 한다)
  let accounts = await getBankAccounts(page);
  while (accounts.length < MIN_BANK_ACCOUNTS) {
    await createBankAccount(page);
    accounts = await getBankAccounts(page);
  }
  expect(accounts.length >= MIN_BANK_ACCOUNTS).toBe(true);

  // 2) 59개: API로 59개가 될 때까지 만들고, 화면에 59개가 보이는지 확인한다
  await createBankAccountsWithApi(page, MAX_BANK_ACCOUNTS - 1);
  await expectListCount(MAX_BANK_ACCOUNTS - 1);

  // 3) 경계값 59개 -> 60개: 59개일 때는 "만들기" 버튼이 눌리고, 60번째 계좌가 만들어진다
  await page.getByTestId("bankaccount-new").click();
  await expect(page).toHaveURL("/bankaccounts/new");
  await createBankAccount(page);
  await expectListCount(MAX_BANK_ACCOUNTS);

  // 4) 경계값 60개: "만들기" 버튼이 꺼지고 안내가 보이며, 서버도 61번째를 거절한다
  await expect(page.getByTestId("bankaccount-new")).toBeDisabled();
  await expect(page.getByTestId("bankaccount-limit")).toBeVisible();
  const refused = await page.request.post("/api/bankAccounts", {
    data: { bankName: "한도 시험", accountNumber: "123456789" },
  });
  expect(refused.status()).toBe(400);

  // 5) 삭제(숨김): 화면에서 3개만 남기고 모두 삭제한다 (금액이 0인 계좌만 삭제할 수 있다)
  accounts = await getBankAccounts(page);
  for (const account of accounts.slice(MIN_BANK_ACCOUNTS)) {
    await deleteInUi(account.id);
  }
  await expectListCount(MIN_BANK_ACCOUNTS);
  await expect(page.getByTestId("bankaccount-limit")).toBeHidden();

  // API 확인: 숨긴 계좌는 목록에 나오지 않고, 3개만 남았다
  const remaining = await getBankAccounts(page);
  expect(remaining.length).toBe(MIN_BANK_ACCOUNTS);

  // 6) 남은 3개도 모두 삭제하면 계좌가 없는 상태가 된다
  for (const account of remaining) {
    await deleteInUi(account.id);
  }
  await expectListCount(0);
  await expect(page.getByTestId("empty-list-header")).toBeVisible();
  expect((await getBankAccounts(page)).length).toBe(0);

  // 7) 하드 삭제 (API): 숨기기만 한 행(60개)이 DB에 남아 있다가, 시험 전용 API로 완전히 지워진다
  await hardDeleteBankAccountsWithApi(page);

  // 8) 다시 만들기: 계좌를 3개 다시 만들 수 있다 (002 입금 시험이 쓸 계좌다)
  for (let count = 0; count < MIN_BANK_ACCOUNTS; count += 1) {
    await createBankAccount(page);
  }
  expect((await getBankAccounts(page)).length).toBe(MIN_BANK_ACCOUNTS);
});
