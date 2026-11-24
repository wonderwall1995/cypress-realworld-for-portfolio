import { expect, Page, test } from "@playwright/test";

/**
 * API 도구: 로그인한 사용자의 은행 계좌를 DB에서 완전히 지운다 (하드 삭제).
 * 앱의 삭제는 숨기기(visible을 끔)라서 행이 남는다. 이 도구는 숨겨진 행까지 모두 지운다.
 * 시연용 API(운영 서버에서도 열려 있다)를 쓴다. 로그인이 필요하고 자기 계좌만 다룬다.
 *   - GET    /api/demo/bankaccounts/count : 이 사용자의 행 수 (숨겨진 행 포함)
 *   - DELETE /api/demo/bankaccounts       : 이 사용자의 행을 모두 지운다
 * 확인: 지우기 전에는 행이 있고(숨겨진 행 포함), 지운 개수가 그 행 수와 같고, 지운 뒤에는 0행이다.
 */
export async function hardDeleteBankAccountsWithApi(page: Page) {
  return test.step("[api] hardDeleteBankAccountsWithApi", async () => {
    const rows = async () => {
      const response = await page.request.get("/api/demo/bankaccounts/count");
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      return body.total as number;
    };

    const before = await rows();
    expect(before > 0).toBe(true);

    const response = await page.request.delete("/api/demo/bankaccounts");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.deleted).toBe(before);

    expect(await rows()).toBe(0);
  });
}
