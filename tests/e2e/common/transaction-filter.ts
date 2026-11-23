import { expect, Page, test } from "@playwright/test";

/** 공통 코드: "내 거래" 목록을 연다. 필터가 보이면 끝난다. */
export async function openMyTransactions(page: Page) {
  return test.step("[common] openMyTransactions", async () => {
    await page.goto("/personal");
    await expect(page.getByTestId("transaction-list-filters")).toBeVisible();
  });
}

/** 금액 필터의 종류: deposit 은 내가 받은 돈, withdrawal 은 내가 보낸 돈 */
export type AmountKind = "deposit" | "withdrawal";

/**
 * 공통 코드: 금액 필터 창을 열고 최소와 최대(달러)를 쓴다. 빈 글자는 "제한 없음"이다.
 * 쓰기만 한다: 안내가 나오는지, 적용 버튼이 꺼지는지는 부른 쪽이 판정한다 (창은 열린 채로 남는다).
 */
export async function fillAmountFilter(
  page: Page,
  kind: AmountKind,
  range: { min: string; max: string }
) {
  return test.step("[common] fillAmountFilter", async () => {
    await page.getByTestId(`transaction-list-filter-${kind}-button`).click();
    await page.getByTestId(`transaction-list-filter-${kind}-min`).fill(range.min);
    await page.getByTestId(`transaction-list-filter-${kind}-max`).fill(range.max);
  });
}

/**
 * 공통 코드: 금액 필터를 쓰고 적용한다. 둘 다 빈 글자면 그 필터를 없앤다.
 * 적용되면 창이 닫히므로, 창이 닫히는 것으로 동작이 됐는지 확인한다. 목록은 부른 쪽이 판정한다.
 */
export async function applyAmountFilter(
  page: Page,
  kind: AmountKind,
  range: { min: string; max: string }
) {
  return test.step("[common] applyAmountFilter", async () => {
    await fillAmountFilter(page, kind, range);
    await page.getByTestId(`transaction-list-filter-${kind}-apply-button`).click();
    await expect(page.getByTestId(`transaction-list-filter-${kind}`)).toBeHidden();
  });
}

/**
 * 공통 코드: 날짜 필터의 시작일과 종료일을 쓴다 ("YYYY-MM-DD", 뒤를 덜 쓰면 그 칸은 비운다).
 * 이 필터는 적용 버튼이 없고, 올바른 범위가 되면 잠시 뒤 저절로 적용된다. 목록과 안내는 부른 쪽이 판정한다.
 */
export async function fillDateFilter(page: Page, start: string, end: string) {
  return test.step("[common] fillDateFilter", async () => {
    const boxes = { start, end };
    for (const box of ["start", "end"] as const) {
      const [year = "", month = "", day = ""] = boxes[box].split("-");
      const prefix = `transaction-list-filter-date-${box}`;
      await page.getByTestId(`${prefix}-year`).fill(year);
      await page.getByTestId(`${prefix}-month`).fill(month);
      await page.getByTestId(`${prefix}-day`).fill(day);
    }
  });
}
