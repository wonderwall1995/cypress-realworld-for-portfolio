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
import { FundedUser } from "./api/create-funded-user";
import { createUsersWithApi } from "./api/create-users";
import { expectProfileBalanceIsAccountSumWithApi } from "./api/expect-profile-balance";
import { getMyBalanceWithApi } from "./api/get-my-balance";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { loginWithApi } from "./api/login";
import { transferWithApi } from "./api/transfer";
import { expectProfileBalanceOnScreen } from "./common/expect-profile-balance-on-screen";
import { signIn } from "./common/signin";
import { confirmTransfer, fillTransfer, openTransferTo, transfer } from "./common/transfer";
import { random } from "./fixture/random";
import { fixtureValue, runFixtures } from "./fixture/run-fixtures";

const START_DOLLARS = 1000; // 세 사람이 처음에 각자 계좌에 가진 돈
const MAX_AMOUNT_DOLLARS = 21_474_836; // 앱이 한 번에 받는 이체 금액의 최대 (센트 칸이 담을 수 있는 크기)

// 이체 요청의 내용: from 의 계좌에서 to 의 계좌로. 거절 시험은 이것을 고쳐서 서버에 직접 보낸다
const payment = (
  from: FundedUser,
  to: FundedUser,
  amount: number | string,
  password = from.user.password
) => ({
  transactionType: "payment",
  amount,
  description: "거절 시험",
  receiverId: to.user.id,
  myAccountId: from.account.id,
  otherAccountId: to.account.id,
  password,
});

test("3. 이체: 돈은 정확히 옮겨지고, 잘못된 이체는 화면과 서버 모두에서 거절된다", async ({
  page,
}) => {
  // 시작: 세 사람을 API로 준비한다 (가입, 로그인, 은행 계좌, 입금). 받는 사람 B, C를 먼저, 보내는 사람 A를 마지막에 만든다.
  //   준비 도구는 브라우저의 로그인을 그 사람으로 바꾼다. 그래서 받는 사람의 준비는 A가 화면에 로그인하기 전에 끝낸다
  //   정식 실행이면 이 번호의 Fixture 값으로, 번호 없는 실행이면 무작위 값으로 만든다
  const { A, B, C } = await createUsersWithApi(page, ["B", "C", "A"], START_DOLLARS, "transfer");
  const fixtures = runFixtures("transfer");
  const cycleDollars = fixtures ? Number(fixtureValue(fixtures, "cycleDollars")) : random(1, 500); // 한 바퀴 돌릴 금액

  // A는 로그인 화면에서 로그인한다 (공통 코드). Main으로 가고, 사이드바 잔액이 처음 금액이다
  await page.goto("/signin");
  await signIn(page, A.user);
  await expect(page).toHaveURL("/");
  await expectProfileBalanceOnScreen(page, START_DOLLARS * 100);

  // 1) 거절: 잔액 부족
  //    화면: 가진 돈보다 1달러 많이 쓰면 "이체" 버튼이 꺼지고 안내가 나온다
  await openTransferTo(page, B.user);
  await fillTransfer(page, { dollars: START_DOLLARS + 1, memo: "잔액 부족" });
  await expect(page.getByTestId("transaction-create-submit-payment")).toBeDisabled();
  await expect(page.getByTestId("transaction-create-not-enough")).toBeVisible();
  //    서버: 버튼이 꺼진 것만으로는 서버가 막는다는 증명이 아니다. 같은 이체를 직접 보내도 거절한다 (400)
  const notEnough = await page.request.post("/api/transactions", {
    data: payment(A, B, START_DOLLARS + 1),
  });
  expect(notEnough.status()).toBe(400);

  // 2) 거절: 잘못된 금액 (0달러, 소수점, 한도 초과)
  //    화면: 버튼이 꺼진다. 서버: 직접 보내도 입력 검사에서 거절한다 (422)
  for (const amount of ["0", "1.5", String(MAX_AMOUNT_DOLLARS + 1)]) {
    await fillTransfer(page, { dollars: amount, memo: "잘못된 금액" });
    await expect(page.getByTestId("transaction-create-submit-payment")).toBeDisabled();
    const wrongAmount = await page.request.post("/api/transactions", {
      data: payment(A, B, amount),
    });
    expect(wrongAmount.status()).toBe(422);
  }

  // 3) 거절: 비밀번호 틀림
  //    화면: 확인 창에 틀린 비밀번호를 쓰면 오류 문구가 나오고, 완료 단계로 가지 않는다
  await fillTransfer(page, { dollars: cycleDollars, memo: "비밀번호 틀림" });
  await confirmTransfer(page, "wrong-password");
  await expect(page.getByTestId("transaction-confirm-error")).toContainText("비밀번호");
  await expect(page.getByTestId("new-transaction-return-to-transactions")).toBeHidden();
  await page.getByTestId("transaction-confirm-cancel").click();
  //    서버: 틀린 비밀번호로 직접 보내도 거절한다 (403)
  const wrongPassword = await page.request.post("/api/transactions", {
    data: payment(A, B, cycleDollars, "wrong-password"),
  });
  expect(wrongPassword.status()).toBe(403);

  // 4) 거절: 남의 계좌에서 보내기 (서버만)
  //    화면의 "내 계좌" 목록에는 내 계좌만 있어서 UI로는 할 수 없는 시험이다. A가 B의 계좌를 자기 계좌라고 적어 보내면 거절한다 (403)
  const notMine = await page.request.post("/api/transactions", {
    data: { ...payment(A, C, cycleDollars), myAccountId: B.account.id },
  });
  expect(notMine.status()).toBe(403);

  //    서버 판정: 거절된 이체는 돈을 움직이지 않는다. A의 잔액은 그대로다
  expect(await getMyBalanceWithApi(page)).toBe(START_DOLLARS * 100);

  // 5) A -> B (화면): 화면으로 끝까지 이체한다 (공통 코드: 완료 단계가 보이면 성공)
  await transfer(page, B.user, { dollars: cycleDollars, memo: "순환 1: A -> B" }, A.user.password);
  //    서버 판정: A의 프로필 잔액은 계좌 금액의 합이고, 그 합은 처음 금액에서 보낸 만큼 줄어든 값이다
  const sentSum = await expectProfileBalanceIsAccountSumWithApi(page);
  expect(sentSum).toBe((START_DOLLARS - cycleDollars) * 100);
  //    화면 판정: A의 사이드바에도 그 금액이 보인다
  await expectProfileBalanceOnScreen(page, sentSum);

  // 6) B -> C, C -> A (API): 나머지 두 사람의 이체는 API로 한다.
  //    화면 시험은 여기까지다. 이제부터 브라우저의 로그인이 B, C로 바뀐다
  await loginWithApi(page, B.user);
  await transferWithApi(page, B, C, cycleDollars, "순환 2: B -> C");
  await loginWithApi(page, C.user);
  await transferWithApi(page, C, A, cycleDollars, "순환 3: C -> A");

  // 7) 서버 판정: 같은 금액으로 한 바퀴 돌았으니 세 사람의 잔액이 모두 처음과 같다. 돈은 생기지도 사라지지도 않았다
  const balances = { A: 0, B: 0, C: 0 };
  for (const [name, who] of Object.entries({ A, B, C })) {
    await loginWithApi(page, who.user);
    balances[name as keyof typeof balances] = await getMyBalanceWithApi(page);
  }
  expect(balances).toEqual({
    A: START_DOLLARS * 100,
    B: START_DOLLARS * 100,
    C: START_DOLLARS * 100,
  });
  expect(balances.A + balances.B + balances.C).toBe(3 * START_DOLLARS * 100);

  // 8) 정리: 번호 없는 실행이면 세 사람의 은행 계좌를 API로 완전히 지운다.
  //    정식 실행이면 남긴다: 나중 실행이 이 번호의 A, B, C로 로그인해 예전 유저도 잘 보이는지 확인한다 (리그레션)
  if (!fixtures) {
    for (const who of [A, B, C]) {
      await loginWithApi(page, who.user);
      await hardDeleteBankAccountsWithApi(page);
    }
  }
});
