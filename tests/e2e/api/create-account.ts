import { expect, Page, test } from "@playwright/test";
import { randomUser, RandomUser } from "../fixture/random-user";

/**
 * API 도구: 가입 API(POST /api/users)로 계정을 만들고, 만든 계정(로그인에 쓰는 값)을 돌려준다.
 * 값(user)을 주면 그 값으로 만들고, 없으면 무작위다.
 * 동작이 됐는지만 확인한다: 계정이 만들어지지 않으면(201이 아니면) 이 도구를 부른 줄에서 테스트가 멈춘다.
 * 화면 가입을 거치지 않고 "로그인할 수 있는 계정"을 빠르게 준비할 때 쓴다. 가입은 로그인을 바꾸지 않는다.
 */
export async function createAccountWithApi(
  page: Page,
  user: RandomUser = randomUser()
): Promise<RandomUser> {
  return test.step("[api] createAccountWithApi", async () => {
    const response = await page.request.post("/api/users", { data: user });
    expect(response.status()).toBe(201);
    return user;
  });
}
