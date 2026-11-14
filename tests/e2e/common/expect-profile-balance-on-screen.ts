import { expect, Page } from "@playwright/test";

/**
 * 공통 코드: 사이드바의 프로필 잔액이 기대한 금액(센트)으로 화면에 표시되는지 확인한다.
 */
export async function expectProfileBalanceOnScreen(page: Page, cents: number) {
  const text = (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  await expect(page.getByTestId("sidenav-user-balance")).toContainText(text);
}
