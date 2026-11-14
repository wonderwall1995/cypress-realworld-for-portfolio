import { expect, Page } from "@playwright/test";

/**
 * 공통 코드: 사이드바의 입금 창을 열고 계좌 하나를 고른다.
 * 입금 창은 열려 있는 채로 남는다. (금액을 쓰는 것은 부른 쪽의 일이다)
 */
export async function openDeposit(page: Page, accountId: string) {
  await page.getByTestId("sidenav-deposit").click();
  await expect(page.getByTestId("deposit-dialog")).toBeVisible();
  await page.getByTestId("deposit-dialog").locator("[role=combobox]").click();
  await page.getByTestId(`deposit-account-${accountId}`).click();
}

/**
 * 공통 코드: 계좌 하나를 골라 입금한다 (금액은 달러, 정수).
 * 입금이 성공해야 창이 닫히므로, 창이 닫히는 것으로 성공을 판정한다.
 */
export async function deposit(page: Page, accountId: string, dollars: number) {
  await openDeposit(page, accountId);
  await page.getByTestId("deposit-amount-input").fill(String(dollars));
  await page.getByTestId("deposit-submit-button").click();
  await expect(page.getByTestId("deposit-dialog")).toBeHidden();
}
