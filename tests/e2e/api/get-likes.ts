import { expect, Page, test } from "@playwright/test";

/** 서버가 알려 주는 좋아요 하나 */
export interface LikeInfo {
  id: string;
  userId: string;
  transactionId: string;
}

/**
 * API 도구: 거래 하나의 좋아요 목록을 서버에서 읽어 돌려준다 (GET /api/likes/:transactionId).
 * 지금 로그인한 사람이 볼 수 있는 거래여야 한다. 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getLikesWithApi(page: Page, transactionId: string): Promise<LikeInfo[]> {
  return test.step("[api] getLikesWithApi", async () => {
    const response = await page.request.get(`/api/likes/${transactionId}`);
    expect(response.ok()).toBeTruthy();
    return (await response.json()).likes;
  });
}
