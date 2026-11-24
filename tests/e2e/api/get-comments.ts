import { expect, Page, test } from "@playwright/test";

/** 서버가 알려 주는 댓글 하나 */
export interface CommentInfo {
  id: string;
  userId: string;
  transactionId: string;
  content: string;
}

/**
 * API 도구: 거래 하나의 댓글 목록을 서버에서 읽어 돌려준다 (GET /api/comments/:transactionId).
 * 지금 로그인한 사람이 볼 수 있는 거래여야 한다. 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getCommentsWithApi(
  page: Page,
  transactionId: string
): Promise<CommentInfo[]> {
  return test.step("[api] getCommentsWithApi", async () => {
    const response = await page.request.get(`/api/comments/${transactionId}`);
    expect(response.ok()).toBeTruthy();
    return (await response.json()).comments;
  });
}
