import { expect, Page, test } from "@playwright/test";

/** 공통 코드: 거래 하나의 상세 화면을 연다. 그 거래의 상세가 보이면 끝난다. */
export async function openTransactionDetail(page: Page, transactionId: string) {
  return test.step("[common] openTransactionDetail", async () => {
    await page.goto(`/transaction/${transactionId}`);
    await expect(page.getByTestId("transaction-detail-header")).toBeVisible();
    await expect(page.getByTestId(`transaction-item-${transactionId}`)).toBeVisible();
  });
}

/**
 * 공통 코드: 상세 화면에서 좋아요를 누른다.
 * 좋아요가 저장되면 앱이 버튼을 끄므로, 버튼이 꺼지는 것으로 동작이 됐는지 확인한다. 개수는 부른 쪽이 판정한다.
 */
export async function likeTransaction(page: Page, transactionId: string) {
  return test.step("[common] likeTransaction", async () => {
    await page.getByTestId(`transaction-like-button-${transactionId}`).click();
    await expect(page.getByTestId(`transaction-like-button-${transactionId}`)).toBeDisabled();
  });
}

/**
 * 공통 코드: 상세 화면에서 댓글을 쓰고 Enter로 등록한다 (이 화면에는 등록 버튼이 없다).
 * 등록된 댓글이 목록에 보이는 것으로 동작이 됐는지 확인한다. 개수와 쓴 사람은 부른 쪽이 판정한다.
 */
export async function writeComment(page: Page, transactionId: string, text: string) {
  return test.step("[common] writeComment", async () => {
    await page.getByTestId(`transaction-comment-input-${transactionId}`).fill(text);
    await page.getByTestId(`transaction-comment-input-${transactionId}`).press("Enter");
    await expect(page.getByTestId("comments-list")).toContainText(text);
  });
}
