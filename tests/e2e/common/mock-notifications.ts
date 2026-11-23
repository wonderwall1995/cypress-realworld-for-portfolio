import { Page, test } from "@playwright/test";

const NOTIFICATIONS_URL = "**/api/notifications**"; // 화면이 알림 목록을 읽는 주소

/**
 * 공통 코드: 모킹. 화면이 알림 목록을 읽을 때 서버 대신 가짜 알림 count개를 준다 (좋아요 알림).
 * 실제로 만들기 힘든 개수를 화면이 어떻게 보여 주는지 볼 때만 쓴다. 서버의 값은 바뀌지 않는다.
 * 화면이 다시 읽어야 보이므로, 부른 쪽이 page.reload() 를 이어서 부른다.
 */
export async function mockNotificationsOnPage(page: Page, count: number) {
  return test.step("[common] mockNotificationsOnPage", async () => {
    const results = Array.from({ length: count }, (_, index) => ({
      id: `mock-${index + 1}`,
      transactionId: "mock-transaction",
      likeId: `mock-like-${index + 1}`,
      userFullName: `가짜 ${index + 1}`,
      isRead: false,
    }));
    await page.unroute(NOTIFICATIONS_URL);
    await page.route(NOTIFICATIONS_URL, (route) => route.fulfill({ json: { results } }));
  });
}

/** 공통 코드: 모킹을 끝낸다. 다음에 읽을 때부터 화면은 다시 진짜 서버의 값을 받는다. */
export async function unmockNotificationsOnPage(page: Page) {
  return test.step("[common] unmockNotificationsOnPage", async () => {
    await page.unroute(NOTIFICATIONS_URL);
  });
}
