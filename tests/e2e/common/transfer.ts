import { expect, Page, test } from "@playwright/test";

/**
 * 공통 코드: 이체 화면을 열고 받는 사람을 고른다. 금액을 쓰는 화면(2단계)이 열리면 끝난다.
 * 받는 사람은 아이디로 찾아서 id 로 고른다 (같은 글자가 들어간 다른 사람을 고르지 않는다).
 */
export async function openTransferTo(page: Page, receiver: { id: string; username: string }) {
  return test.step("[common] openTransferTo", async () => {
    await page.goto("/transaction/new");
    await page.getByTestId("user-list-search-input").fill(receiver.username);
    await page.getByTestId(`user-list-item-${receiver.id}`).click();
    await expect(page.getByTestId("transaction-create-form")).toBeVisible();
  });
}

/**
 * 공통 코드: 이체 화면(2단계)에 금액(달러)과 메모를 쓴다. 계좌는 처음 골라진 것을 그대로 쓴다.
 * 쓰기만 한다: 버튼이 켜지는지, 안내가 나오는지는 부른 쪽이 판정한다 (거절 시험이 여기서 멈춰 판정한다).
 */
export async function fillTransfer(page: Page, input: { dollars: number | string; memo: string }) {
  return test.step("[common] fillTransfer", async () => {
    await page
      .getByTestId("transaction-create-amount-input")
      .locator("input")
      .fill(String(input.dollars));
    await page
      .getByTestId("transaction-create-description-input")
      .locator("input")
      .fill(input.memo);
  });
}

/**
 * 공통 코드: "이체"를 누르고, 확인 창에 비밀번호를 쓰고, "이체"(확인)를 누른다.
 * 누르기까지만 한다: 이체가 끝났는지, 오류 문구가 나왔는지는 부른 쪽이 판정한다 (비밀번호 틀림 시험이 여기서 판정한다).
 */
export async function confirmTransfer(page: Page, password: string) {
  return test.step("[common] confirmTransfer", async () => {
    await page.getByTestId("transaction-create-submit-payment").click();
    await expect(page.getByTestId("transaction-confirm-dialog")).toBeVisible();
    await page.getByTestId("transaction-confirm-password").fill(password);
    await page.getByTestId("transaction-confirm-confirm").click();
  });
}

/**
 * 공통 코드: 화면으로 이체를 끝까지 한다. 받는 사람 고르기 -> 금액과 메모 -> 비밀번호 확인.
 * 서버가 이체를 받아 줘야 완료 단계(3단계)로 가므로, 완료 단계가 보이는 것으로 성공을 판정한다.
 */
export async function transfer(
  page: Page,
  receiver: { id: string; username: string },
  input: { dollars: number; memo: string },
  password: string
) {
  return test.step("[common] transfer", async () => {
    await openTransferTo(page, receiver);
    await fillTransfer(page, input);
    await confirmTransfer(page, password);
    await expect(page.getByTestId("new-transaction-return-to-transactions")).toBeVisible();
  });
}
