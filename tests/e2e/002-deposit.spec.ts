import { test, expect } from "@playwright/test";
import { getBankAccounts } from "./api/get-bank-accounts";
import { createBankAccount } from "./common/create-bank-account";
import { deposit, openDeposit } from "./common/deposit";
import { goToMain } from "./common/go-to-main";

const MIN_BANK_ACCOUNTS = 3; // 입금 시험을 하려면 계좌가 이만큼은 있어야 한다 (앱의 최대는 60개)
const DEPOSIT_DOLLARS = 100;

// min 이상 max 이하의 무작위 정수 (달러). 입금 금액의 "구간" 시험에 쓴다
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

test("2. 입금: 계좌마다 입금하고, 경계값과 금액 구간을 시험한다", async ({ page, request }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page, request);

  // 페이지 확인: 지금 화면이 Main(주소 /)이다
  await expect(page).toHaveURL("/");

  // 계좌는 앞 테스트(001)가 만들어 둔다. 이 파일만 따로 돌릴 때를 위해, 3개보다 적으면 모자란 만큼 만든다 (3개 이상이면 건너뜀)
  // 계좌 하나를 만들 때마다 그 계좌가 실제로 있고 금액이 0인지 API로 확인한다 (공통 코드가 한꺼번에 한다)
  let accounts = await getBankAccounts(page);
  while (accounts.length < MIN_BANK_ACCOUNTS) {
    await createBankAccount(page);
    accounts = await getBankAccounts(page);
  }

  // 계좌마다 "지금 있어야 할 금액"(센트)을 적어 둔다. 처음 값은 입금 전 금액이다 (이번에 만든 계좌는 0)
  const expected = new Map(accounts.map((account) => [account.id, account.balance]));

  // 이 계좌의 금액이 expected와 같은지 화면과 API로 확인한다
  const expectBalance = async (accountId: string) => {
    const expectedCents = expected.get(accountId)!;

    // 화면 확인: 은행 계좌 목록에 이 계좌의 금액이 표시된다
    await page.goto("/bankaccounts");
    await expect(page.getByTestId(`bankaccount-balance-${accountId}`)).toContainText(money(expectedCents));

    // API 확인: 서버가 알고 있는 이 계좌의 금액도 같다
    const response = await page.request.get("/api/bankAccounts");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const found = body.results.find((item: { id: string }) => item.id === accountId);
    expect(found !== undefined).toBe(true);
    expect(found.balance).toBe(expectedCents);
  };

  // 입금하고, expected를 올린 뒤, 화면과 API의 금액을 확인한다
  const depositAndExpect = async (accountId: string, dollars: number) => {
    await deposit(page, accountId, dollars);
    expected.set(accountId, expected.get(accountId)! + dollars * 100);
    await expectBalance(accountId);
  };

  // 입금이 거절되는 금액: 입금 버튼이 꺼지고 이유가 보이며, 금액은 그대로다
  const expectDepositRefused = async (accountId: string, amountText: string) => {
    await openDeposit(page, accountId);
    await page.getByTestId("deposit-amount-input").fill(amountText);
    await expect(page.getByTestId("deposit-submit-button")).toBeDisabled();
    await expect(page.getByTestId("deposit-dialog")).toContainText("1 이상");
    await page.getByTestId("deposit-cancel-button").click();
    await expect(page.getByTestId("deposit-dialog")).toBeHidden();
    await expectBalance(accountId);
  };

  // 입력은 맞지만 서버가 거절하는 금액: 입금 버튼은 눌리고, 서버의 거절 안내가 보이며, 금액은 그대로다
  const expectDepositRefusedByServer = async (accountId: string, dollars: number) => {
    await openDeposit(page, accountId);
    await page.getByTestId("deposit-amount-input").fill(String(dollars));
    await page.getByTestId("deposit-submit-button").click();
    await expect(page.getByTestId("deposit-error")).toBeVisible();
    await page.getByTestId("deposit-cancel-button").click();
    await expect(page.getByTestId("deposit-dialog")).toBeHidden();
    await expectBalance(accountId);
  };

  // 1) 계좌마다 100달러를 입금한다
  for (const account of accounts) {
    await depositAndExpect(account.id, DEPOSIT_DOLLARS);
  }

  // 2) 금액 구간 (구간 안의 값은 무작위): 계좌 하나가 구간 둘 또는 하나를 맡는다
  await depositAndExpect(accounts[0].id, random(1, 10));
  await depositAndExpect(accounts[0].id, random(10, 100));
  await depositAndExpect(accounts[1].id, random(100, 1000));
  await depositAndExpect(accounts[1].id, random(1000, 10000));
  await depositAndExpect(accounts[2].id, random(10000, 100000));

  // ============================================================================================
  // 경계값 테스트 (첫 번째 계좌)
  // 입금액이 허용되는 범위(1달러 이상 21,474,836달러 이하)의 양 끝과 그 바로 바깥을 시험한다.
  // ============================================================================================
  const first = accounts[0].id;

  // 최소값: 최소 입금액은 1달러다. -1달러와 0달러는 거절되고 1달러는 된다
  await expectDepositRefused(first, "-1");
  await expectDepositRefused(first, "0");
  await depositAndExpect(first, 1);

  // 최대값: 한 번에 넣을 수 있는 최대 입금액은 21,474,836달러다.
  //   한 단계 위(21,474,837달러)는 입력 단계에서 거절된다.
  //   최대 입금액은 입력으로는 맞지만, 이 사용자의 총 잔액이 한도(2,147,483,647센트)를 넘게 되므로 서버가 거절한다.
  await expectDepositRefused(first, "21474837");
  await expectDepositRefusedByServer(first, 21474836);
});
