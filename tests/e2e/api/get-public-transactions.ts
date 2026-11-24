import { expect, Page, test } from "@playwright/test";
import { TransactionInfo } from "./get-my-transactions";

/**
 * API 도구: "전체" 거래 목록을 읽어 돌려준다 (GET /api/transactions/public, 최신 50건).
 * 모두가 함께 쓰는 목록이라 다른 사람의 거래도 섞여 있다. 개수를 세지 말고 우리 거래가 있는지 없는지를 본다.
 * 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getPublicTransactionsWithApi(page: Page): Promise<TransactionInfo[]> {
  return test.step("[api] getPublicTransactionsWithApi", async () => {
    const response = await page.request.get("/api/transactions/public?page=1&limit=50");
    expect(response.status()).toBe(200);
    return (await response.json()).results;
  });
}
