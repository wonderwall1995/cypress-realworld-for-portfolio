import { test, expect } from "@playwright/test";
import { expectProfileBalanceIsAccountSum } from "./api/expect-profile-balance";
import { expectProfileBalanceOnScreen } from "./common/expect-profile-balance-on-screen";
import { goToMain } from "./common/go-to-main";

test("3. 프로필: 내 잔액은 은행 계좌 금액의 합과 같다", async ({ page, request }) => {
  // Main이 아니면 API로 계정을 만들고 화면에서 로그인해서 Main으로 간다 (공통 코드)
  await goToMain(page, request);

  // 페이지 확인: 지금 화면이 Main(주소 /)이다
  await expect(page).toHaveURL("/");

  // API 확인: 프로필 잔액이 계좌 금액의 합과 같고, 그 합을 돌려받는다
  const sumCents = await expectProfileBalanceIsAccountSum(page);

  // 화면 확인: 사이드바의 프로필 잔액이 그 합으로 표시된다
  await expectProfileBalanceOnScreen(page, sumCents);
});
