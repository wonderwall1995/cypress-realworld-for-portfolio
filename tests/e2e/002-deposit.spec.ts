/**
 * ===== 테스트 코드 공통 머리말 =====
 * 원본은 testcode.template.ts 이다. 모든 *.spec.ts 의 맨 위에 이 글을 똑같이 둔다. 고칠 때는 원본과 모든 사본을 함께 고친다.
 *
 * [세팅]
 * - 도구: Playwright (TypeScript). 설정은 playwright.config.ts 에 있다.
 * - 파일 이름: NNN-이름.spec.ts. 번호는 읽는 순서일 뿐, 실행 순서를 약속하지 않는다.
 * - 제한 시간: 테스트 하나에 3분 (playwright.config.ts 의 기본값).
 * - 서버: 테스트 전에 웹(Vite)과 API(Express)가 떠 있어야 한다. 이미 떠 있으면 그 서버를 쓴다.
 * - 폴더: common/ 은 화면 동작 묶음, api/ 는 API 도구다. API 도구는 호출과 판정을 스스로 한다.
 *
 * [의도: 주요 테스트 코드 별 생성 목적]
 * - 테스트 파일 하나는 목적 하나를 가진다. 그 목적을 test() 의 제목에 한 줄로 쓴다.
 * - 파일은 서로 독립이다. 다른 파일의 결과나 실행 순서에 기대지 않는다. 그래서 파일들을 병렬로 돌릴 수 있어야 한다.
 * - 공통 준비(로그인 등)는 common/ 코드로 한다. 그 기능 자체의 시험은 그 기능의 파일 하나만 맡는다. (예: 회원가입은 000-auth 만 시험한다)
 *
 * [설계 공통]
 * - 시작: goToMain 으로 자기 계정을 준비하고 Main 에서 시작한다. 시험에 필요한 데이터는 자기가 만든다.
 * - 판정: 한 동작을 화면(UI expect)과 서버(API expect) 두 곳에서 본다. 둘 다 맞아야 통과한다.
 * - 속도: 소량은 화면으로 한다. 대량(연속 생성, 연속 삭제)은 API로 하고, 화면은 그 결과를 읽을 수 있는지만 본다.
 * - 삭제: 앱의 화면 삭제는 숨김(soft delete)이다. 있음/없음은 visible 을 생각해서 본다. 완전 삭제는 API 도구로 한다.
 * - 값: 입력 값은 무작위로 만든다. 경계값은 따로 정해서 시험한다.
 * - 실패: 도구가 호출과 판정을 스스로 하므로, 실패한 줄이 곧 원인 지점이다.
 * ===== 공통 머리말 끝 =====
 */

import { test, expect } from "@playwright/test";
import { createBankAccountsWithApi } from "./api/create-bank-accounts";
import { getBankAccountRows } from "./api/get-bank-account-rows";
import { getBankAccounts } from "./api/get-bank-accounts";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { deposit, openDeposit } from "./common/deposit";
import { goToMain } from "./common/go-to-main";

const BANK_ACCOUNTS = 3; // 입금 시험에 쓰는 계좌 수 (앱의 최대는 60개)
const DEPOSIT_DOLLARS = 100;

// min 이상 max 이하의 무작위 정수 (달러). 입금 금액의 "구간" 시험에 쓴다
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

test("2. 입금: 계좌마다 입금하고, 경계값과 금액 구간을 시험한다", async ({ page, request }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page, request);

  // 페이지 확인: 지금 화면이 Main(주소 /)이다
  await expect(page).toHaveURL("/");

  // 준비: 깨끗한 상태에서 자기 계좌를 만든다. 앞 실행이 남긴 계좌 행이 있으면 API로 완전히 지운다
  // 계좌 만들기 자체는 001이 시험하므로, 여기서는 API로 빠르게 3개를 만든다
  if ((await getBankAccountRows(page)).total > 0) {
    await hardDeleteBankAccountsWithApi(page);
  }
  await createBankAccountsWithApi(page, BANK_ACCOUNTS);
  await page.reload(); // API로 만든 계좌를 화면이 다시 읽게 한다
  const accounts = await getBankAccounts(page);
  expect(accounts.length).toBe(BANK_ACCOUNTS);

  // 계좌마다 "지금 있어야 할 금액"(센트)을 적어 둔다. 처음 값은 입금 전 금액이다 (새 계좌라 0)
  const expected = new Map(accounts.map((account) => [account.id, account.balance]));

  // 이 계좌의 금액이 expected와 같은지 화면과 API로 확인한다
  const expectBalance = async (accountId: string) => {
    const expectedCents = expected.get(accountId)!;

    // 화면 확인: 은행 계좌 목록에 이 계좌의 금액이 표시된다
    await page.goto("/bankaccounts");
    await expect(page.getByTestId(`bankaccount-balance-${accountId}`)).toContainText(money(expectedCents));

    // API 확인: 서버가 알고 있는 이 계좌의 금액도 같다 (API 도구)
    const found = (await getBankAccounts(page)).find((account) => account.id === accountId);
    expect(found !== undefined).toBe(true);
    expect(found!.balance).toBe(expectedCents);
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

  // 정리: 이 시험이 만든 계좌를 API로 완전히 지운다. 금액이 있는 계좌는 화면에서 삭제할 수 없으므로 API 도구를 쓴다
  await hardDeleteBankAccountsWithApi(page);
  expect(await getBankAccountRows(page)).toEqual({ total: 0, visible: 0, hidden: 0 });
});
