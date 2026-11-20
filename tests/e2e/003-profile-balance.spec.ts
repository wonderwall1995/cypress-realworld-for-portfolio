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
import { expectProfileBalanceIsAccountSum } from "./api/expect-profile-balance";
import { getBankAccountRows } from "./api/get-bank-account-rows";
import { getBankAccounts } from "./api/get-bank-accounts";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { deposit } from "./common/deposit";
import { expectProfileBalanceOnScreen } from "./common/expect-profile-balance-on-screen";
import { goToMain } from "./common/go-to-main";

const BANK_ACCOUNTS = 3; // 합을 내는 계좌 수

// min 이상 max 이하의 무작위 정수 (달러)
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

test("3. 프로필: 내 잔액은 은행 계좌 금액의 합과 같다", async ({ page, request }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page, request);

  // 페이지 확인: 지금 화면이 Main(주소 /)이다
  await expect(page).toHaveURL("/");

  // 1) 준비: 깨끗한 상태에서 자기 계좌를 만들고, 계좌마다 다른 금액을 넣는다
  //    계좌 만들기는 001, 입금은 002가 시험하므로, 여기서는 API 도구와 입금 공통 코드로 준비만 한다
  if ((await getBankAccountRows(page)).total > 0) {
    await hardDeleteBankAccountsWithApi(page);
  }
  await createBankAccountsWithApi(page, BANK_ACCOUNTS);
  await page.reload(); // API로 만든 계좌를 화면이 다시 읽게 한다
  for (const account of await getBankAccounts(page)) {
    await deposit(page, account.id, random(1, 1000));
  }

  // 2) API 확인: 프로필 잔액이 계좌 금액의 합과 같고, 그 합을 돌려받는다
  const sumCents = await expectProfileBalanceIsAccountSum(page);
  expect(sumCents > 0).toBe(true);

  // 3) 화면 확인: 사이드바의 프로필 잔액이 그 합으로 표시된다
  await expectProfileBalanceOnScreen(page, sumCents);

  // 4) 정리: 계좌를 API로 완전히 지우면, 프로필 잔액도 0으로 함께 돌아온다 (API와 화면 둘 다)
  await hardDeleteBankAccountsWithApi(page);
  expect(await expectProfileBalanceIsAccountSum(page)).toBe(0);
  await page.reload();
  await expectProfileBalanceOnScreen(page, 0);
});
