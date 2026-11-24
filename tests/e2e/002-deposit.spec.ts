/**
 * ===== 테스트 코드 공통 머리말 =====
 * 원본은 testcode.template.ts 이다. 모든 *.spec.ts 의 맨 위에 이 글을 똑같이 둔다. 고칠 때는 원본과 모든 사본을 함께 고친다.
 *
 * [세팅]
 * - 도구: Playwright (TypeScript). 설정은 playwright.config.ts 에 있다.
 * - 파일 이름: NNN-이름.spec.ts. 번호는 읽는 순서일 뿐, 실행 순서를 약속하지 않는다.
 * - 제한 시간: 테스트 하나에 3분 (playwright.config.ts 의 기본값).
 * - 서버: 테스트 전에 웹(Vite)과 API(Express)가 떠 있어야 한다. 이미 떠 있으면 그 서버를 쓴다.
 * - 폴더: common/ 은 화면 동작 묶음, api/ 는 API 도구, fixture/ 는 테스트에 쓰는 값을 만드는 도구다. 만드는 법은 [도구 약속]을 따른다.
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
 * - 실패: 도구는 자기 동작이 됐는지 스스로 확인하므로, 실패한 줄이 곧 원인 지점이다.
 *
 * [도구 약속] (api/, common/, fixture/ 에 도구를 만들 때 지킨다. 기존 도구는 손볼 때 맞춘다)
 * - 받는 것: 첫 번째 인자는 언제나 page 다. API 요청은 page.request 로 보낸다. 따로 떨어진 request 는 쓰지 않는다.
 * - 판정: 동작 도구(만들기, 지우기, 입금 등)는 그 동작이 됐는지만 확인한다. 그 밖의 판정은 이름이 expect 로 시작하는 도구나 spec 의 expect 줄에 둔다.
 * - 돌려주는 것: 만드는 도구는 만든 것(id 포함)을, 읽는 도구는 읽은 값을 돌려준다. 값이 여럿이면 순서가 아니라 이름 붙은 묶음({ A, B, C })으로 돌려준다.
 * - 이름: 동사로 시작한다(create, get, delete, expect 등). API 도구는 끝에 WithApi, 화면 판정 도구는 끝에 OnScreen 을 붙인다. 화면 동작 도구는 붙이지 않는다.
 * - 단계: 도구의 몸체를 test.step("[종류] 도구 이름", ...) 으로 감싼다. 종류는 common, api, fixture 중 하나다. 기록기가 이 단계로 도구별 성공/실패를 모은다.
 * - 예외: 값만 만드는 함수(fixture/ 의 random 등)는 page 를 받지 않고 단계로 감싸지 않는다.
 * ===== 공통 머리말 끝 =====
 */

import { test, expect } from "@playwright/test";
import { createBankAccountsWithApi } from "./api/create-bank-accounts";
import { expectProfileBalanceIsAccountSumWithApi } from "./api/expect-profile-balance";
import { getBankAccountRows } from "./api/get-bank-account-rows";
import { getBankAccounts } from "./api/get-bank-accounts";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { deposit, openDeposit } from "./common/deposit";
import { expectProfileBalanceOnScreen } from "./common/expect-profile-balance-on-screen";
import { goToMain } from "./common/go-to-main";
import { random } from "./fixture/random";

const BANK_ACCOUNTS = 3; // 입금 시험에 쓰는 계좌 수 (앱의 최대는 60개)
const DEPOSIT_DOLLARS = 100;
const MAX_DEPOSIT_DOLLARS = 21_474_836; // 앱이 한 번에 받는 입금액의 최대

// 화면의 금액 글자: 소수점 없는 달러 ($1,234). 앱은 센트로 저장하지만 화면에는 달러만 보인다
const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

test("2. 입금: 계좌마다 입금하고, 경계값과 금액 구간을 시험한다", async ({ page }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page, "deposit");

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
    await expect(page.getByTestId(`bankaccount-balance-${accountId}`)).toHaveText(
      `잔액: ${money(expectedCents)}`
    );

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
  await expectDepositRefused(first, String(MAX_DEPOSIT_DOLLARS + 1));
  await expectDepositRefusedByServer(first, MAX_DEPOSIT_DOLLARS);

  // 같은 금액을 서버에 직접 보내도 거절한다. 화면이 막는 것만으로는 서버가 막는다는 증명이 아니다
  //   1보다 작거나 정수가 아닌 금액은 입력 검사에서(422), 한도를 넘는 금액은 잔액 검사에서(400) 거절하고, 계좌 금액은 그대로다
  const answered: Record<string, number> = {};
  for (const amount of [-1, 0, 1.5, MAX_DEPOSIT_DOLLARS + 1, MAX_DEPOSIT_DOLLARS]) {
    const response = await page.request.post("/api/bankTransfers", {
      data: { bankAccountId: first, amount, type: "deposit" },
    });
    answered[`${amount}달러`] = response.status();
  }
  expect(answered).toEqual({
    "-1달러": 422,
    "0달러": 422,
    "1.5달러": 422,
    "21474837달러": 400,
    "21474836달러": 400,
  });
  await expectBalance(first);

  // 프로필 잔액: 입금이 모두 끝난 뒤, 내 잔액은 계좌 금액의 합이다
  //   기대 합계는 서버 값이 아니라 이 시험이 넣은 금액(expected)으로 계산한다. 서버와 화면이 같이 틀려도 잡아낸다
  const expectedSum = [...expected.values()].reduce((sum, cents) => sum + cents, 0);
  //   서버 판정: 프로필 잔액 = 계좌 금액의 합 (API 도구), 그리고 그 합이 넣은 금액의 합과 같다
  const sum = await expectProfileBalanceIsAccountSumWithApi(page);
  expect(sum).toBe(expectedSum);
  //   화면 판정: 사이드바에 그 금액이 보인다 (공통 코드)
  await expectProfileBalanceOnScreen(page, sum);

  // 정리: 이 시험이 만든 계좌를 API로 완전히 지운다. 금액이 있는 계좌는 화면에서 삭제할 수 없으므로 API 도구를 쓴다
  await hardDeleteBankAccountsWithApi(page);
  expect(await getBankAccountRows(page)).toEqual({ total: 0, visible: 0, hidden: 0 });
  //   계좌가 없어지면 프로필 잔액도 0으로 돌아온다 (서버와 화면)
  expect(await expectProfileBalanceIsAccountSumWithApi(page)).toBe(0);
  await page.reload();
  await expectProfileBalanceOnScreen(page, 0);

  // 최대값의 안쪽: 잔액이 0이면 최대 입금액이 한 번에 들어간다. 거기에 1달러를 더 넣으면 총 잔액 한도를 넘어 서버가 거절한다
  await createBankAccountsWithApi(page, 1);
  await page.reload();
  const [empty] = await getBankAccounts(page);
  expected.set(empty.id, empty.balance);
  await depositAndExpect(empty.id, MAX_DEPOSIT_DOLLARS);
  await expectDepositRefusedByServer(empty.id, 1);
  expect(await expectProfileBalanceIsAccountSumWithApi(page)).toBe(MAX_DEPOSIT_DOLLARS * 100);
  await hardDeleteBankAccountsWithApi(page);
});
