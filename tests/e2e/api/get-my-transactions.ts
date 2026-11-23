import { expect, Page, test } from "@playwright/test";

/** 거래 목록의 한 줄 (이 시험들이 쓰는 값만) */
export interface TransactionInfo {
  id: string;
  amount: number; // 센트
  senderId: string;
  receiverId: string;
  createdAt: string;
}

/** 거래 목록의 필터. 금액은 센트, 날짜는 ISO 글자다 */
export type TransactionFilter = Partial<
  Record<
    | "depositMin"
    | "depositMax"
    | "withdrawalMin"
    | "withdrawalMax"
    | "dateRangeStart"
    | "dateRangeEnd",
    string | number
  >
>;

/** 거래 목록을 묻는 주소. 거절을 보는 시험은 spec에서 이 주소로 직접 요청을 보내 응답 코드를 판정한다 */
export const myTransactionsUrl = (filter: TransactionFilter = {}) => {
  const query = new URLSearchParams({ page: "1", limit: "10" });
  for (const [key, value] of Object.entries(filter)) query.set(key, String(value));
  return `/api/transactions?${query}`;
};

/**
 * API 도구: 지금 로그인한 사람의 거래 목록을 필터를 걸어 읽어 돌려준다 (GET /api/transactions, 첫 10건).
 * 읽기가 되지 않으면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getMyTransactionsWithApi(
  page: Page,
  filter: TransactionFilter = {}
): Promise<TransactionInfo[]> {
  return test.step("[api] getMyTransactionsWithApi", async () => {
    const response = await page.request.get(myTransactionsUrl(filter));
    expect(response.status()).toBe(200);
    return (await response.json()).results;
  });
}
