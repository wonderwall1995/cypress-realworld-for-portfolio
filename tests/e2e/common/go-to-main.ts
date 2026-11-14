import { APIRequestContext, expect, Page } from "@playwright/test";
import { createAccountWithApi } from "../api/create-account";
import { signIn } from "./signin";

/**
 * 공통 코드: 테스트를 Main(주소 /)에서 시작하게 만든다.
 * - 이미 로그인한 화면이면 새 계정을 만들지 않는다. Main이 아니면 Main으로만 간다. (앞 테스트에서 이어진 시연이 그 경우다)
 * - 로그인 전 화면이거나 빈 화면이면 API로 계정을 만들고, 화면에서 로그인해서 Main으로 간다.
 *   이 앱은 로그인 상태를 브라우저가 기억하므로, API로 로그인하는 것만으로는 화면이 로그인되지 않는다.
 */
export async function goToMain(page: Page, request: APIRequestContext) {
  // 로그인 전 화면(/signin, /signup)과 빈 화면(about:blank)이 아니면, 앱 안쪽 화면이므로 이미 로그인한 것이다
  const url = new URL(page.url());
  const loggedIn = url.origin !== "null" && url.pathname !== "/signin" && url.pathname !== "/signup";
  if (loggedIn) {
    if (url.pathname !== "/") await page.goto("/");
    return;
  }

  await page.goto("/signin");
  const user = await createAccountWithApi(request);
  await signIn(page, user);
  await expect(page).toHaveURL("/");
}
