import { expect, Page, test } from "@playwright/test";

/** 공통 코드: 위쪽의 종을 눌러 알림 화면을 연다. 주소가 /notifications 이면 끝난다. */
export async function openNotifications(page: Page) {
  return test.step("[common] openNotifications", async () => {
    await page.getByTestId("nav-top-notifications-link").click();
    await expect(page).toHaveURL("/notifications");
  });
}

/** 공통 코드: 알림 화면에서 알림 하나의 "확인"을 누른다. 그 알림의 "확인"이 사라지면 끝난다 (알림은 남는다). */
export async function confirmNotification(page: Page, notificationId: string) {
  return test.step("[common] confirmNotification", async () => {
    await page.getByTestId(`notification-mark-read-${notificationId}`).click();
    await expect(page.getByTestId(`notification-mark-read-${notificationId}`)).toBeHidden();
  });
}
