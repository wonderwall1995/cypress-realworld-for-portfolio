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
import { getBankAccountRows } from "./api/get-bank-account-rows";
import { getBankAccounts } from "./api/get-bank-accounts";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { createBankAccount } from "./common/create-bank-account";
import { deleteBankAccount } from "./common/delete-bank-account";
import { expectBankAccountListCount, expectBankAccountOnScreen } from "./common/expect-bank-account-on-screen";
import { goToMain } from "./common/go-to-main";
import { random } from "./fixture/random";

const MAX_BANK_ACCOUNTS = 60; // 앱이 한 사용자에게 허용하는 계좌 수의 최대


test("1. 은행 계좌: 소량은 화면으로, 대량은 API로, 59~61번째 경계는 화면으로 시험한다", async ({ page }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page);

  // 페이지 확인: 지금 화면이 Main(주소 /)이다
  await expect(page).toHaveURL("/");

  // 0) 깨끗한 상태로 시작: 앞 실행이 남긴 계좌 행(숨긴 행 포함)이 있으면 API로 완전히 지운다
  if ((await getBankAccountRows(page)).total > 0) {
    await hardDeleteBankAccountsWithApi(page);
  }
  expect(await getBankAccountRows(page)).toEqual({ total: 0, visible: 0, hidden: 0 });

  // 1) 소량(1~3개 만들기, 만든 수 이하만큼 삭제): 화면이 판정하고, 삭제는 DB에 숨김(soft delete)으로 남는지 API로 확인한다
  const createCount = random(1, 3);
  const deleteCount = random(1, createCount);

  // 1-1) 화면으로 만든다. 만들 때마다 그 계좌가 실제로 있고 금액이 0인지 API로 확인한다 (공통 코드가 한꺼번에 한다)
  const created = [];
  for (let count = 0; count < createCount; count += 1) {
    created.push(await createBankAccount(page));
  }
  // 화면 확인: 만든 계좌가 모두 목록에 있고, 개수가 맞다
  for (const account of created) {
    await expectBankAccountOnScreen(page, account, true);
  }
  await expectBankAccountListCount(page, createCount);

  // 1-2) 화면에서 deleteCount개를 삭제한다. 삭제는 지우는 것이 아니라 숨기는 것이다
  const deleted = created.slice(0, deleteCount);
  const kept = created.slice(deleteCount);
  for (const account of deleted) {
    await deleteBankAccount(page, account.id);
  }
  // 화면 확인: 삭제한 계좌는 없고, 남긴 계좌는 그대로 있다
  for (const account of deleted) {
    await expectBankAccountOnScreen(page, account, false);
  }
  for (const account of kept) {
    await expectBankAccountOnScreen(page, account, true);
  }
  await expectBankAccountListCount(page, kept.length);

  // API 확인: 앱의 목록에는 남긴 계좌만 나오지만, DB에는 삭제한 계좌가 숨긴 행(soft delete)으로 남아 있다
  expect((await getBankAccounts(page)).length).toBe(kept.length);
  expect(await getBankAccountRows(page)).toEqual({ total: createCount, visible: kept.length, hidden: deleteCount });

  // 2) 대량(연속 생성): API로 58개가 될 때까지 만들고, 화면은 목록을 읽을 수 있는지(58개가 보이는지)만 본다
  await createBankAccountsWithApi(page, MAX_BANK_ACCOUNTS - 2);
  await expectBankAccountListCount(page, MAX_BANK_ACCOUNTS - 2);

  // 3) 경계값 59 ~ 61번째 (화면): 59번째와 60번째는 만들어지고, 61번째는 만들 수 없다
  for (const count of [MAX_BANK_ACCOUNTS - 1, MAX_BANK_ACCOUNTS]) {
    await page.goto("/bankaccounts");
    await expect(page.getByTestId("bankaccount-new")).toBeEnabled();
    await page.getByTestId("bankaccount-new").click();
    await expect(page).toHaveURL("/bankaccounts/new");
    const account = await createBankAccount(page);
    await expectBankAccountOnScreen(page, account, true);
    await expectBankAccountListCount(page, count);
  }

  // 61번째: 화면은 "만들기" 버튼을 끄고 안내를 보여 주며, 서버도 거절한다. 계좌는 그대로 60개다
  await page.goto("/bankaccounts");
  await expect(page.getByTestId("bankaccount-new")).toBeDisabled();
  await expect(page.getByTestId("bankaccount-limit")).toBeVisible();
  const refused = await page.request.post("/api/bankAccounts", {
    data: { bankName: "한도 시험", accountNumber: "123456789" },
  });
  expect(refused.status()).toBe(400);
  await expectBankAccountListCount(page, MAX_BANK_ACCOUNTS);
  expect((await getBankAccountRows(page)).visible).toBe(MAX_BANK_ACCOUNTS);

  // 4) 대량(연속 삭제) + 정리: API로 숨긴 행까지 모두 완전히 지우고, 화면은 빈 목록을 읽을 수 있는지만 본다
  //    이 시험이 만든 데이터를 남기지 않는다 (다른 파일은 자기 계좌를 스스로 만든다)
  await hardDeleteBankAccountsWithApi(page);
  await expectBankAccountListCount(page, 0);
  expect(await getBankAccountRows(page)).toEqual({ total: 0, visible: 0, hidden: 0 });
});
