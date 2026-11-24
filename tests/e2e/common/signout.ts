import { expect, Page, test } from "@playwright/test";

/** 공통 코드: 사이드바의 로그아웃을 누른다. 로그인 화면으로 돌아오는 것으로 동작이 됐는지 확인한다. */
export async function signOut(page: Page) {
  return test.step("[common] signOut", async () => {
    await page.getByTestId("sidenav-signout").click();
    await expect(page).toHaveURL("/signin");
    await expect(page.getByTestId("signin-submit")).toBeVisible();
  });
}
