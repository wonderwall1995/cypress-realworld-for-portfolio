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
import { createUsersWithApi } from "./api/create-users";
import { getMeWithApi, Me } from "./api/get-me";
import { getMyBalanceWithApi } from "./api/get-my-balance";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { loginWithApi } from "./api/login";
import { signIn } from "./common/signin";
import { fillUserSettings, openUserSettings, saveUserSettings } from "./common/user-settings";
import { Profile, randomProfile } from "./fixture/random-profile";

const START_DOLLARS = 100; // 두 사람이 처음에 계좌에 넣은 돈. 정보를 고쳐도 잔액은 그대로여야 한다

// 서버의 내 정보를 설정 화면의 모양으로 바꾼다 (비운 값은 서버에서 null, 화면에서 빈 글자다)
const profileOf = (me: Me): Profile => ({
  lastName: me.lastName,
  firstName: me.firstName,
  email: me.email ?? "",
  phoneNumber: me.phoneNumber ?? "",
});

test("6. 사용자 설정: 정보를 고치고 되돌릴 수 있고, 잘못된 정보는 화면과 서버 모두에서 거절된다", async ({
  page,
}) => {
  // 준비 (API): A와 남(B)을 만든다. 가입할 때의 정보가 처음 값이다. 가입에는 이메일이 없으므로 비어 있다
  const { A, B } = await createUsersWithApi(page, ["B", "A"], START_DOLLARS);
  const signedUp = ({ user }: typeof A): Profile => ({
    lastName: user.lastName,
    firstName: user.firstName,
    email: "",
    phoneNumber: user.phoneNumber,
  });
  const original = signedUp(A);
  const changed = randomProfile();
  const fullName = page.getByTestId("sidenav-user-full-name");

  // 1) 화면: 로그인하면 사이드바에 가입한 이름과 아이디가 보인다. 설정 화면을 연다 (공통 코드)
  await page.goto("/signin");
  await signIn(page, A.user);
  await expect(page).toHaveURL("/");
  await expect(fullName).toHaveText(`${original.lastName} ${original.firstName}`);
  await expect(page.getByTestId("sidenav-username")).toHaveText(`@${A.user.username}`);
  await openUserSettings(page);

  // 2) 거절 (화면): 빈 이름, 잘못된 이메일, 잘못된 전화번호는 안내가 나오고 저장 버튼이 꺼진다
  for (const [item, wrong, message] of [
    ["firstName", "", "이름을 입력하세요"],
    ["email", "not-an-email", "올바른 이메일 주소가 아닙니다"],
    ["phoneNumber", "abc", "올바른 전화번호가 아닙니다 (예: 010-1234-5678)"],
  ] as const) {
    await fillUserSettings(page, { [item]: wrong });
    await expect(page.locator(`#user-settings-${item}-input-helper-text`)).toHaveText(message);
    await expect(page.getByTestId("user-settings-submit")).toBeDisabled();
    await fillUserSettings(page, { [item]: original[item] });
    await expect(page.getByTestId("user-settings-submit")).toBeEnabled();
  }

  // 3) 거절 (서버): 같은 값을 직접 보내도 거절하고(422), 남의 정보는 고칠 수 없다(403).
  //    화면처럼 모든 값을 함께 보낸다. 하나만 보내면 다른 이유로 거절될 수 있다
  const sent = async (userId: string, change: object) =>
    (
      await page.request.patch(`/api/users/${userId}`, { data: { ...original, ...change } })
    ).status();
  const answered = {
    emptyFirstName: await sent(A.user.id, { firstName: "" }),
    blankLastName: await sent(A.user.id, { lastName: "   " }),
    wrongEmail: await sent(A.user.id, { email: "not-an-email" }),
    wrongPhone: await sent(A.user.id, { phoneNumber: "abc" }),
    someoneElse: await sent(B.user.id, {}),
  };
  expect(answered).toEqual({
    emptyFirstName: 422,
    blankLastName: 422,
    wrongEmail: 422,
    wrongPhone: 422,
    someoneElse: 403,
  });
  //    아이디와 잔액은 고칠 수 있는 정보가 아니다: 함께 보내도 바뀌지 않는다
  await sent(A.user.id, { username: "stolen", balance: 999_999 });
  const untouched = await getMeWithApi(page);
  expect(profileOf(untouched)).toEqual(original);
  expect(untouched.username).toBe(A.user.username);
  expect(await getMyBalanceWithApi(page)).toBe(START_DOLLARS * 100);

  // 4) 수정 (화면): 이름, 이메일, 전화번호를 고쳐 저장하면 사이드바의 이름이 바뀐다
  await saveUserSettings(page, changed);
  await expect(fullName).toHaveText(`${changed.lastName} ${changed.firstName}`);
  //    서버 판정: 서버의 값도 고친 값과 같다
  expect(profileOf(await getMeWithApi(page))).toEqual(changed);

  // 5) 새로고침해도 고친 값이다 (화면이 서버의 값을 다시 읽는다)
  await page.reload();
  await expect(fullName).toHaveText(`${changed.lastName} ${changed.firstName}`);

  // 6) 되돌리기 (화면): 처음 정보로 되돌린다. 이메일을 비우는 것도 저장된다
  await saveUserSettings(page, original);
  await expect(fullName).toHaveText(`${original.lastName} ${original.firstName}`);
  expect(profileOf(await getMeWithApi(page))).toEqual(original);

  // 7) 거절된 요청은 남의 정보를 바꾸지 않았다 (서버). 화면 시험이 끝났으므로 B로 로그인해서 B의 정보를 읽는다
  await loginWithApi(page, B.user);
  expect(profileOf(await getMeWithApi(page))).toEqual(signedUp(B));

  // 정리: 두 사람의 은행 계좌를 API로 완전히 지운다
  for (const who of [B, A]) {
    await loginWithApi(page, who.user);
    await hardDeleteBankAccountsWithApi(page);
  }
});
