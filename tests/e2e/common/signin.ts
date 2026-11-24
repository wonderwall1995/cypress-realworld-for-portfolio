import { Page, test } from "@playwright/test";

/** 로그인 화면에서 사용자 ID와 비밀번호를 입력하고 로그인 버튼을 누른다. */
export async function signIn(page: Page, user: { username: string; password: string }) {
  return test.step("[common] signIn", async () => {
    await page.getByTestId("signin-username").locator("input").fill(user.username);
    await page.getByTestId("signin-password").locator("input").fill(user.password);
    await page.getByTestId("signin-submit").click();
  });
}
