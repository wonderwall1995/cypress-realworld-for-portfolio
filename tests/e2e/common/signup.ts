import { expect, Page } from "@playwright/test";
import { randomUser, RandomUser } from "../fixture/random-user";

/**
 * 로그인 화면에서 회원가입 화면으로 가서, 무작위 값으로 가입한다. 가입이 끝나 로그인 화면으로 돌아오면 끝난다.
 * 비밀번호 확인 칸은 화면 규칙상 비밀번호와 같은 값이어야 한다.
 */
export async function signUpWithRandomUser(page: Page): Promise<RandomUser> {
  const user = randomUser();

  await page.getByTestId("signup").click();
  // 가입 화면이 열린다: 주소가 /signup 이고 가입 화면의 제목이 보인다
  await expect(page).toHaveURL("/signup");
  await expect(page.getByTestId("signup-title")).toBeVisible();

  await page.getByTestId("signup-last-name").locator("input").fill(user.lastName);
  await page.getByTestId("signup-first-name").locator("input").fill(user.firstName);
  await page.getByTestId("signup-username").locator("input").fill(user.username);
  await page.getByTestId("signup-phone-number").locator("input").fill(user.phoneNumber);
  await page.getByTestId("signup-password").locator("input").fill(user.password);
  await page.getByTestId("signup-confirmPassword").locator("input").fill(user.password);
  await page.getByTestId("signup-submit").click();

  // 가입이 끝나면 앱이 로그인 화면으로 돌아온다. 이 확인으로 가입 요청이 끝날 때까지 기다린다.
  // (이 도구를 부른 뒤 곧바로 API로 계정을 확인해도, 서버에 계정이 이미 만들어져 있다)
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  return user;
}
