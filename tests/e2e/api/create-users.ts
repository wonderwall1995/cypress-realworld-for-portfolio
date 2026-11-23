import { Page, test } from "@playwright/test";
import { createFundedUserWithApi, FundedUser } from "./create-funded-user";

/**
 * API 도구: 여러 사람을 이름 붙은 묶음으로 한 번에 준비한다. 각자 은행 계좌 하나와 그 안의 돈(달러, 정수)을 가진다.
 * 예: createUsersWithApi(page, ["B", "C", "A"], 1000) -> { B, C, A }
 * 사람의 값은 지금 fixture 도구가 만든다. 나중에 Fixture DB에서 값을 받게 되면 이 도구의 안쪽만 바뀐다.
 * 주의: 적은 순서대로 만들고, 끝나면 브라우저의 로그인은 마지막 사람이다 (createFundedUserWithApi 참고).
 */
export async function createUsersWithApi<Name extends string>(
  page: Page,
  names: readonly Name[],
  dollars: number
): Promise<Record<Name, FundedUser>> {
  return test.step("[api] createUsersWithApi", async () => {
    const users = {} as Record<Name, FundedUser>;
    for (const name of names) {
      users[name] = await createFundedUserWithApi(page, dollars);
    }
    return users;
  });
}
