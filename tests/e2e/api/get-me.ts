import { expect, Page, test } from "@playwright/test";

/** 서버가 알려 주는 내 정보. 비운 이메일과 전화번호는 null 이다 */
export interface Me {
  id: string;
  username: string;
  lastName: string;
  firstName: string;
  email: string | null;
  phoneNumber: string | null;
  defaultPrivacyLevel: string;
}

/**
 * API 도구: 지금 로그인한 사람의 정보를 서버에서 읽어 돌려준다 (GET /api/checkAuth).
 * 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getMeWithApi(page: Page): Promise<Me> {
  return test.step("[api] getMeWithApi", async () => {
    const response = await page.request.get("/api/checkAuth");
    expect(response.ok()).toBeTruthy();
    return (await response.json()).user;
  });
}
