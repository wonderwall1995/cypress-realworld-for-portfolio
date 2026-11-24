import { expect, Page, test } from "@playwright/test";

/**
 * 공통 코드: 사이드바의 프로필 잔액이 기대한 금액으로 화면에 표시되는지 확인한다.
 * 금액은 센트로 받는다(서버가 센트로 준다). 화면은 소수점 없는 달러로 보이므로($1,234) 같은 형식으로 바꿔 비교한다.
 * 글자 전체가 같아야 통과한다($12 를 기대할 때 $120 은 통과하지 않는다).
 */
export async function expectProfileBalanceOnScreen(page: Page, cents: number) {
  return test.step("[common] expectProfileBalanceOnScreen", async () => {
    const text = (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    await expect(page.getByTestId("sidenav-user-balance")).toHaveText(text);
  });
}
