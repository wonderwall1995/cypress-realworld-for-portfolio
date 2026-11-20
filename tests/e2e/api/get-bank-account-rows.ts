import { expect, Page } from "@playwright/test";

/** DB에 있는 은행 계좌 행 수. 숨긴 행(앱의 삭제)도 센다. */
export interface BankAccountRows {
  total: number; // DB의 모든 행
  visible: number; // 앱에 보이는 행
  hidden: number; // 앱이 숨기기만 한 행 (soft delete)
}

/**
 * API 도구: 로그인한 사용자의 은행 계좌 행 수를 DB에서 센다 (GET /api/demo/bankaccounts/count).
 * 앱의 삭제는 지우는 것이 아니라 숨기는 것이라, 삭제한 계좌가 DB에 남아 있는지(hidden)를 이 도구로 확인한다.
 * 화면의 로그인(쿠키)을 그대로 쓰므로 page.request로 부른다. 응답이 성공이 아니면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getBankAccountRows(page: Page): Promise<BankAccountRows> {
  const response = await page.request.get("/api/demo/bankaccounts/count");
  expect(response.ok()).toBeTruthy();
  return response.json();
}
