import { expect, Page } from "@playwright/test";

/** 가입에 쓰는 무작위 값 한 벌 */
export interface RandomUser {
  lastName: string;
  firstName: string;
  username: string;
  phoneNumber: string;
  password: string;
}

const randomInt = (max: number) => Math.floor(Math.random() * max);

// 영어 소문자 난수 (첫 글자는 대문자)
const randomEnglish = (length: number) => {
  const letters = Array.from({ length }, () => String.fromCharCode(97 + randomInt(26))).join("");
  return letters[0].toUpperCase() + letters.slice(1);
};

// 한글 난수: 가(U+AC00)부터 힣(U+D7A3)까지의 글자
const randomKorean = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(0xac00 + randomInt(0xd7a3 - 0xac00 + 1))).join("");

// 숫자 난수 네 자리 (앞자리가 0이어도 네 자리)
const randomFourDigits = () => String(randomInt(10000)).padStart(4, "0");

export const randomUser = (): RandomUser => ({
  lastName: randomEnglish(6),
  firstName: randomEnglish(6),
  username: randomKorean(3),
  phoneNumber: `010-${randomFourDigits()}-${randomFourDigits()}`,
  password: randomFourDigits(),
});

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
