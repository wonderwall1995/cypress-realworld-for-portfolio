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
import { createFundedUserWithApi } from "./api/create-funded-user";
import { expectLoggedInAsWithApi } from "./api/expect-logged-in-as";
import { getMyBalanceWithApi } from "./api/get-my-balance";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { loginWithApi } from "./api/login";
import { expectProfileBalanceOnScreen } from "./common/expect-profile-balance-on-screen";
import { signIn } from "./common/signin";
import { signOut } from "./common/signout";
import { randomDigits } from "./fixture/random";
import { randomBankAccountInput } from "./fixture/random-bank-account";
import { randomUser } from "./fixture/random-user";

const A_DOLLARS = 1000; // 두 사람의 돈을 다르게 두어, 화면에 누구의 잔액이 보이는지 구별한다
const B_DOLLARS = 500;
const WRONG_LOGIN = "사용자 ID 또는 비밀번호가 올바르지 않습니다"; // 무엇이 틀렸는지는 알려 주지 않는다

// 로그인한 사람만 볼 수 있는 화면과 API
const PROTECTED_SCREENS = [
  "/personal",
  "/bankaccounts",
  "/notifications",
  "/user/settings",
  "/transaction/new",
  "/",
];
const PROTECTED_APIS = [
  "/api/checkAuth",
  "/api/users",
  "/api/bankAccounts",
  "/api/transactions",
  "/api/transactions/public",
  "/api/notifications",
];

test("9. 로그인 실패와 로그아웃: 틀린 로그인은 거절되고, 로그아웃하면 화면도 서버도 닫힌다", async ({
  page,
}) => {
  // 준비 (API): 두 사람을 만든다. 비밀번호는 대소문자를 구별하는지 보려고 글자를 섞고, 앞 글자를 달리해 둘이 같지 않게 한다
  const inputOf = (letters: string) => ({
    user: { ...randomUser(), password: `${letters}${randomDigits(4)}` },
    account: randomBankAccountInput(),
  });
  const B = await createFundedUserWithApi(page, B_DOLLARS, inputOf("Bb"));
  const A = await createFundedUserWithApi(page, A_DOLLARS, inputOf("Aa"));
  //   준비 도구가 브라우저를 A로 로그인시켰다. 로그아웃하고, 아무도 로그인하지 않은 상태에서 시작한다
  await page.request.post("/api/logout");

  // 로그인하지 않았으면 보호된 API는 모두 거절한다 (401)
  const expectApisClosed = async () => {
    const answered: Record<string, number> = {};
    for (const path of PROTECTED_APIS) {
      answered[path] = (await page.request.get(path)).status();
    }
    expect(answered).toEqual(Object.fromEntries(PROTECTED_APIS.map((path) => [path, 401])));
  };
  // 로그인하지 않았으면 보호된 주소를 직접 열어도 로그인 화면으로 간다
  const expectScreensClosed = async () => {
    for (const path of PROTECTED_SCREENS) {
      await page.goto(path);
      await expect(page).toHaveURL("/signin");
      await expect(page.getByTestId("signin-submit")).toBeVisible();
    }
  };

  // ============================================================================================
  // 로그인 실패
  // ============================================================================================
  // 1) 서버: 틀린 로그인은 거절한다. 없는 아이디와 틀린 비밀번호의 답이 같아서 아이디가 있는지 알아낼 수 없다
  const { username, password } = A.user;
  const answered: Record<string, number> = {};
  for (const [name, data] of Object.entries({
    "틀린 비밀번호": { username, password: "wrong-password" },
    "대소문자가 다른 비밀번호": { username, password: password.toLowerCase() },
    "한 글자 모자란 비밀번호": { username, password: password.slice(0, -1) },
    "뒤에 빈칸이 붙은 비밀번호": { username, password: `${password} ` },
    "다른 사람의 비밀번호": { username, password: B.user.password },
    "없는 아이디": { username: `${username}-none`, password },
    "빈 비밀번호": { username, password: "" },
    "빈 아이디": { username: "", password },
  })) {
    answered[name] = (await page.request.post("/api/login", { data })).status();
  }
  expect(answered).toEqual({
    "틀린 비밀번호": 401,
    "대소문자가 다른 비밀번호": 401,
    "한 글자 모자란 비밀번호": 401,
    "뒤에 빈칸이 붙은 비밀번호": 401,
    "다른 사람의 비밀번호": 401,
    "없는 아이디": 401,
    "빈 비밀번호": 400,
    "빈 아이디": 400,
  });
  //    거절된 로그인 뒤에도 서버는 닫혀 있다. 돈을 보내는 요청도 거절한다
  await expectApisClosed();
  const notSent = await page.request.post("/api/transactions", {
    data: {
      transactionType: "payment",
      amount: 1,
      description: "로그인하지 않은 이체",
      receiverId: B.user.id,
      myAccountId: A.account.id,
      otherAccountId: B.account.id,
      password,
    },
  });
  expect(notSent.status()).toBe(401);

  // 2) 화면: 보호된 주소를 직접 열어도 로그인 화면으로 간다
  await expectScreensClosed();

  // 3) 화면: 비밀번호가 4자보다 짧으면 로그인 버튼이 꺼진다
  await page.getByTestId("signin-username").locator("input").fill(username);
  await page.getByTestId("signin-password").locator("input").fill("123");
  await expect(page.getByTestId("signin-submit")).toBeDisabled();

  // 4) 화면: 틀린 비밀번호로 로그인하면 안내가 나오고 로그인 화면에 머문다. 서버도 로그인시키지 않았다
  await signIn(page, { username, password: "wrong-password" });
  await expect(page.getByTestId("signin-error")).toHaveText(WRONG_LOGIN);
  await expect(page).toHaveURL("/signin");
  await expectApisClosed();

  // 5) 실패한 뒤에도 맞는 비밀번호로는 로그인된다. 거절된 이체는 돈을 움직이지 않았다
  await signIn(page, A.user);
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("sidenav-username")).toContainText(username);
  await expectLoggedInAsWithApi(page, A.user);
  expect(await getMyBalanceWithApi(page)).toBe(A_DOLLARS * 100);
  await expectProfileBalanceOnScreen(page, A_DOLLARS * 100);

  // ============================================================================================
  // 로그아웃
  // ============================================================================================
  // 6) A가 자기 은행 계좌를 보다가 로그아웃한다. 화면은 로그인 화면이 되고, 서버도 닫힌다
  const accountOf = (who: typeof A) => page.getByTestId(`bankaccount-list-item-${who.account.id}`);
  await page.getByTestId("sidenav-bankaccounts").click();
  await expect(accountOf(A)).toBeVisible();
  await signOut(page);
  await expectApisClosed();

  // 7) 새로고침 없이 같은 창에서 바로 B가 로그인하면 B의 것만 보인다. 앞서 쓴 A의 이름, 잔액, 계좌는 남아 있지 않다
  await signIn(page, B.user);
  await expect(page).toHaveURL("/");
  await expectLoggedInAsWithApi(page, B.user);
  await expect(page.getByTestId("sidenav-username")).toContainText(B.user.username);
  await expectProfileBalanceOnScreen(page, B_DOLLARS * 100);
  await page.getByTestId("sidenav-bankaccounts").click();
  await expect(accountOf(B)).toBeVisible();
  await expect(accountOf(A)).toHaveCount(0);

  // 8) B도 로그아웃한다. 뒤로 가기, 새로고침, 주소를 직접 여는 것으로도 로그인한 화면은 다시 열리지 않는다
  await signOut(page);
  await page.goBack();
  await expect(page).toHaveURL("/signin");
  await page.reload();
  await expect(page).toHaveURL("/signin");
  await expectScreensClosed();

  // 9) 없는 아이디로 로그인해도 틀린 비밀번호와 안내가 같다 (로그인에 성공하면 앞의 안내가 지워지므로, 이것은 새 안내다)
  await expect(page.getByTestId("signin-error")).toBeHidden();
  await signIn(page, { username: `${username}-none`, password });
  await expect(page.getByTestId("signin-error")).toHaveText(WRONG_LOGIN);

  // 정리: 두 사람의 은행 계좌를 API로 완전히 지운다
  for (const who of [A, B]) {
    await loginWithApi(page, who.user);
    await hardDeleteBankAccountsWithApi(page);
  }
});
