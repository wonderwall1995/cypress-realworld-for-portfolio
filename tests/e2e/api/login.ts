import { expect, Page, test } from "@playwright/test";

/**
 * API 도구: 로그인 API(POST /api/login)로 이 사용자로 로그인한다.
 * 주의: page.request 는 화면과 같은 로그인(쿠키)을 쓴다. 그래서 이 도구를 부르면 브라우저의 로그인이 이 사용자로 바뀐다.
 *   화면은 그 사실을 모르므로(앱은 로그인 상태를 따로 기억한다), 화면 시험이 끝난 뒤나 화면 로그인 전에만 부른다.
 * 동작이 됐는지만 확인한다: 로그인이 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function loginWithApi(page: Page, user: { username: string; password: string }) {
  return test.step("[api] loginWithApi", async () => {
    const response = await page.request.post("/api/login", {
      data: { username: user.username, password: user.password },
    });
    expect(response.ok()).toBeTruthy();
  });
}
