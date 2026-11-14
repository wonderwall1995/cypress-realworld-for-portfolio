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
