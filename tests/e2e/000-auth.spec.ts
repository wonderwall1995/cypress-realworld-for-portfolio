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
import { expectLoginWorks } from "./api/login";
import { signUpWithRandomUser } from "./common/signup";
import { signIn } from "./common/signin";

test("0. 무작위 값으로 회원가입하고 로그인한다", async ({ page, request }) => {
  // 로그인 화면이 열린다: 주소가 /signin 이고 제목 "로그인"이 보인다
  await page.goto("/signin");
  await expect(page).toHaveURL("/signin");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  // 화면에서 무작위 값으로 회원가입한다 (공통 코드: 가입 화면의 주소 /signup 도 그 안에서 확인한다).
  // 가입이 끝나 로그인 화면으로 돌아오면 끝난다
  const user = await signUpWithRandomUser(page);
  await expect(page).toHaveURL("/signin");

  // API 도구: 가입 직후, 서버가 이 계정을 로그인시켜 주는지 확인한다 (화면 로그인과는 별개의 확인)
  await expectLoginWorks(request, user);

  // 화면에서 같은 계정으로 로그인하면 Main(주소 /)으로 가고 사이드바에 내 사용자 ID가 보인다 (공통 코드)
  await signIn(page, user);
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("sidenav-username")).toBeVisible();
});
