import { APIRequestContext, expect } from "@playwright/test";
import { randomUser, RandomUser } from "../common/signup";

/**
 * API 도구: 가입 API(POST /api/users)로 무작위 계정을 만든다.
 * 도구는 호출과 판정까지 스스로 한다. 계정이 만들어지지 않으면(201이 아니면) 이 도구를 부른 줄에서 테스트가 멈춘다.
 * 화면 가입을 거치지 않고 "로그인할 수 있는 계정"을 빠르게 준비할 때 쓴다.
 */
export async function createAccountWithApi(request: APIRequestContext): Promise<RandomUser> {
  const user = randomUser();
  const response = await request.post("/api/users", { data: user });
  expect(response.status()).toBe(201);
  return user;
}
