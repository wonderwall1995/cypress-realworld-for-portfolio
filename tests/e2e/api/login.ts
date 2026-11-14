import { APIRequestContext, expect } from "@playwright/test";

/**
 * API 도구: 이 계정으로 로그인 API(POST /api/login)가 실제로 성공하는지 확인한다.
 * 도구는 호출과 판정까지 스스로 한다. 성공하지 못하면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function expectLoginWorks(
  request: APIRequestContext,
  user: { username: string; password: string }
) {
  const response = await request.post("/api/login", {
    data: { username: user.username, password: user.password },
  });
  expect(response.ok()).toBeTruthy();
}
