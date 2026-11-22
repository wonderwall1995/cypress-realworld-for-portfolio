import { expect, Page, test } from "@playwright/test";
import { createAccountWithApi } from "../api/create-account";
import { signIn } from "./signin";

/**
 * 공통 코드: 테스트를 Main(주소 /)에서 시작하게 만들고, 이 테스트가 쓰는 계정을 돌려준다.
 * - 테스트는 언제나 로그인 기록이 없는 새 브라우저에서 시작한다. (시연도 테스트마다 로그아웃해서 같은 상태를 만든다)
 * - API로 이 테스트만의 계정을 만들고, 화면에서 로그인해서 Main으로 간다.
 *   이 앱은 로그인 상태를 브라우저가 기억하므로, API로 로그인하는 것만으로는 화면이 로그인되지 않는다.
 */
export async function goToMain(page: Page) {
  return test.step("[common] goToMain", async () => {
    await page.goto("/signin");
    const user = await createAccountWithApi(page);
    await signIn(page, user);
    await expect(page).toHaveURL("/");
    return user;
  });
}
