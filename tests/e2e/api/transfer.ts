import { expect, Page, test } from "@playwright/test";
import { FundedUser } from "./create-funded-user";

/**
 * API 도구: 지금 로그인한 사람(from)이 다른 사람(to)에게 이체한다 (POST /api/transactions, 달러, 정수).
 * from 의 계좌에서 to 의 계좌로 보낸다. 비밀번호는 from 의 것을 쓴다. 먼저 loginWithApi(page, from.user)로 로그인해 둔다.
 * 공개 범위(privacyLevel)를 주지 않으면 보낸 사람의 기본값이다. 만든 거래를 돌려준다.
 * 동작이 됐는지만 확인한다: 이체가 되지 않으면(200이 아니면) 이 도구를 부른 줄에서 테스트가 멈춘다.
 * 거절되는지 보는 시험은 이 도구를 쓰지 않고 spec 에서 요청을 직접 보내 응답 코드를 판정한다.
 */
export async function transferWithApi(
  page: Page,
  from: FundedUser,
  to: FundedUser,
  dollars: number,
  memo = "API 이체",
  privacyLevel?: "public" | "private"
) {
  return test.step("[api] transferWithApi", async () => {
    const response = await page.request.post("/api/transactions", {
      data: {
        transactionType: "payment",
        amount: dollars,
        description: memo,
        receiverId: to.user.id,
        myAccountId: from.account.id,
        otherAccountId: to.account.id,
        password: from.user.password,
        privacyLevel,
      },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).transaction;
  });
}
