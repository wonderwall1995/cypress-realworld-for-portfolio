import { expect, Page, test } from "@playwright/test";

/**
 * 공통 코드: 화면에서 은행 계좌 하나를 삭제한다.
 * 앱의 삭제는 지우는 것이 아니라 숨기는 것(visible을 끔)이다. 금액이 0인 계좌만 삭제할 수 있다.
 * 삭제가 되면 그 계좌가 목록에서 사라지므로, 사라지는 것으로 성공을 판정한다.
 *
 * 메모: 지금은 001-bank-account.spec.ts 안에서만, 삭제할 계좌 수만큼(1~3번) 반복해서 쓴다.
 * 다른 테스트 파일이 쓰지 않으면 spec 안의 함수로 되돌릴 수 있다 (보류 중인 결정).
 */
export async function deleteBankAccount(page: Page, accountId: string) {
  return test.step("[common] deleteBankAccount", async () => {
    await page.goto("/bankaccounts");
    await page
      .locator(
        `[data-testid="bankaccount-list-item-${accountId}"] [data-testid="bankaccount-delete"]`
      )
      .click();
    await expect(page.getByTestId(`bankaccount-list-item-${accountId}`)).toBeHidden();
  });
}
