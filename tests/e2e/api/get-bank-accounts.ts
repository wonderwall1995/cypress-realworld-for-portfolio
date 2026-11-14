import { expect, Page } from "@playwright/test";

/** 은행 계좌 한 개 (API가 주는 값 중 시험에 쓰는 것). balance는 센트 단위다. */
export interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
}

/**
 * API 도구: 로그인한 사용자의 은행 계좌를 모두 가져온다 (GET /api/bankAccounts).
 * 화면의 로그인(쿠키)을 그대로 쓰므로 page.request로 부른다.
 * 응답이 성공이 아니면 이 도구를 부른 줄에서 테스트가 멈춘다.
 */
export async function getBankAccounts(page: Page): Promise<BankAccountInfo[]> {
  const response = await page.request.get("/api/bankAccounts");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.results;
}
