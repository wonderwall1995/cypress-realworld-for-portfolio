import { expect, Page } from "@playwright/test";

/**
 * API 도구: 로그인한 사용자의 은행 계좌를 DB에서 완전히 지운다 (하드 삭제).
 * 앱의 삭제는 숨기기(visible을 끔)라서 행이 남는다. 이 도구는 숨겨진 행까지 모두 지운다.
 * 시험 전용 API(DELETE /api/testData/bankaccounts/mine)를 쓰며, 개발·시험 서버에서만 열려 있다.
 * 확인: 지우기 전에는 이 사용자의 행이 있고, 지운 개수가 그 행 수와 같고, 지운 뒤에는 0행이다.
 */
export async function hardDeleteBankAccountsWithApi(page: Page) {
  const me = await (await page.request.get("/api/checkAuth")).json();
  const myRows = async () => {
    const response = await page.request.get("/api/testData/bankaccounts");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    return body.results.filter((row: { userId: string }) => row.userId === me.user.id).length;
  };

  const before = await myRows();
  expect(before > 0).toBe(true);

  const response = await page.request.delete("/api/testData/bankaccounts/mine");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.deleted).toBe(before);

  expect(await myRows()).toBe(0);
}
