import { expect, Page, test } from "@playwright/test";
import { Profile } from "../fixture/random-profile";

/**
 * API 도구: 지금 로그인한 사람의 정보를 이 값으로 맞춘다 (PATCH /api/users/:id).
 * 앞선 실행이 중간에 멈춰 정보가 바뀐 채 남았어도, 시험을 정해진 값에서 시작하게 한다.
 * 동작이 됐는지만 확인한다: 바뀌지 않으면(204가 아니면) 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function setMyProfileWithApi(page: Page, id: string, profile: Profile) {
  return test.step("[api] setMyProfileWithApi", async () => {
    const response = await page.request.patch(`/api/users/${id}`, { data: profile });
    expect(response.status()).toBe(204);
  });
}
