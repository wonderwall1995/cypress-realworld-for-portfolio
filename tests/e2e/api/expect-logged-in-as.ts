import { expect, Page, test } from "@playwright/test";

/**
 * API 도구: 지금 이 브라우저가 서버에 누구로 로그인되어 있는지 묻고, 그 사람이 주어진 사용자인지 판정한다 (GET /api/checkAuth).
 * 화면 로그인 뒤에 부른다: 화면이 Main으로 갔다는 것만으로는 서버가 이 사용자로 로그인시켰는지 알 수 없다.
 * 화면의 로그인(쿠키)을 그대로 쓰므로 page.request로 부른다. 로그인되어 있지 않거나 다른 사람이면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function expectLoggedInAsWithApi(page: Page, user: { username: string }) {
  return test.step("[api] expectLoggedInAsWithApi", async () => {
    const response = await page.request.get("/api/checkAuth");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.user.username).toBe(user.username);
  });
}
