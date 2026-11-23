import { expect, Page, test } from "@playwright/test";

/** 공통 코드: 거래 목록의 "전체" 탭을 누른다. 주소가 / 이고 목록이 보이면 끝난다. */
export async function openAllTransactions(page: Page) {
  return test.step("[common] openAllTransactions", async () => {
    await page.getByTestId("nav-public-tab").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("transaction-list")).toBeVisible();
  });
}

/** 공통 코드: 거래 목록의 "내 거래" 탭을 누른다. 주소가 /personal 이고 목록이 보이면 끝난다. */
export async function openMyTransactionsTab(page: Page) {
  return test.step("[common] openMyTransactionsTab", async () => {
    await page.getByTestId("nav-personal-tab").click();
    await expect(page).toHaveURL("/personal");
    await expect(page.getByTestId("transaction-list")).toBeVisible();
  });
}
