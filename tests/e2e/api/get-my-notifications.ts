import { expect, Page, test } from "@playwright/test";

/** 읽지 않은 알림 하나 (이 시험들이 쓰는 값만). 이체는 status, 좋아요는 likeId, 댓글은 commentId 가 있다 */
export interface NotificationInfo {
  id: string;
  transactionId: string;
  userFullName: string; // 알림을 일으킨 사람 (성 이름)
  status?: string;
  likeId?: string;
  commentId?: string;
}

/**
 * API 도구: 지금 로그인한 사람의 읽지 않은 알림을 새것부터 읽어 돌려준다 (GET /api/notifications).
 * 화면의 모킹(mockNotificationsOnPage)은 이 도구에 닿지 않는다. 언제나 진짜 서버의 값이다.
 * 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getMyNotificationsWithApi(page: Page): Promise<NotificationInfo[]> {
  return test.step("[api] getMyNotificationsWithApi", async () => {
    const response = await page.request.get("/api/notifications");
    expect(response.status()).toBe(200);
    return (await response.json()).results;
  });
}
