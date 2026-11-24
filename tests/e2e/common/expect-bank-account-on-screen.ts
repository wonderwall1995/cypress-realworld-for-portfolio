import { expect, Page, test } from "@playwright/test";

// 메모: 이 파일의 두 함수는 지금 001-bank-account.spec.ts 안에서만 여러 번 쓴다.
// - expectBankAccountOnScreen: 만든 계좌, 삭제한 계좌, 남긴 계좌, 59·60번째 계좌마다 (실행마다 4~9번)
// - expectBankAccountListCount: 1~4단계마다 (6번)
// 다른 테스트 파일이 쓰지 않으면 spec 안의 함수로 되돌릴 수 있다 (보류 중인 결정).

/**
 * 공통 코드: 은행 계좌 목록 화면에서 이 계좌가 있는지(present = true), 없는지(present = false) 확인한다.
 * - 있다: 목록 항목이 보이고, 은행 이름과 계좌 번호가 만든 값과 같다.
 * - 없다: 그 계좌의 목록 항목이 하나도 없다.
 */
export async function expectBankAccountOnScreen(
  page: Page,
  account: { id: string; bankName: string; accountNumber: string },
  present: boolean
) {
  return test.step("[common] expectBankAccountOnScreen", async () => {
    await page.goto("/bankaccounts");
    const item = page.getByTestId(`bankaccount-list-item-${account.id}`);
    if (present) {
      await expect(item).toBeVisible();
      await expect(item).toContainText(account.bankName);
      await expect(page.getByTestId(`bankaccount-account-number-${account.id}`)).toContainText(
        account.accountNumber
      );
    } else {
      await expect(item).toHaveCount(0);
    }
  });
}

/** 공통 코드: 은행 계좌 목록 화면에 계좌가 count개 보이는지 확인한다 (목록을 읽을 수 있는지 본다). */
export async function expectBankAccountListCount(page: Page, count: number) {
  return test.step("[common] expectBankAccountListCount", async () => {
    await page.goto("/bankaccounts");
    await expect(page.locator('[data-testid^="bankaccount-list-item-"]')).toHaveCount(count);
    if (count === 0) {
      await expect(page.getByTestId("empty-list-header")).toBeVisible();
    }
  });
}
