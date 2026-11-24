import { Page, test } from "@playwright/test";
import { fixtureValue, LabelFixtures, runFixtures } from "../fixture/run-fixtures";
import { runUser } from "../fixture/run-user";
import { createFundedUserWithApi, FundedUser, FundedUserInput } from "./create-funded-user";

// 이름표의 값에서 한 사람을 만들 값을 꺼낸다
const inputOf = (label: string, fixtures: LabelFixtures, name: string): FundedUserInput => {
  const of = (item: string) => fixtureValue(fixtures, `${name}.${item}`);
  return {
    user: runUser(label, name),
    account: { bankName: of("bankName"), accountNumber: of("accountNumber") },
  };
};

/**
 * API 도구: 여러 사람을 이름 붙은 묶음으로 한 번에 준비한다. 각자 은행 계좌 하나와 그 안의 돈(달러, 정수)을 가진다.
 * 예: createUsersWithApi(page, ["B", "C", "A"], 1000, "transfer") -> { B, C, A }
 * 이름표(label)를 주면 정식 실행에서는 그 번호의 Fixture 값으로 만든다. 번호 없는 실행이나 이름표가 없으면 무작위다.
 * 주의: 적은 순서대로 만들고, 끝나면 브라우저의 로그인은 마지막 사람이다 (createFundedUserWithApi 참고).
 */
export async function createUsersWithApi<Name extends string>(
  page: Page,
  names: readonly Name[],
  dollars: number,
  label?: string
): Promise<Record<Name, FundedUser>> {
  return test.step("[api] createUsersWithApi", async () => {
    const fixtures = label ? runFixtures(label) : undefined;
    const users = {} as Record<Name, FundedUser>;
    for (const name of names) {
      const input = label && fixtures ? inputOf(label, fixtures, name) : undefined;
      users[name] = await createFundedUserWithApi(page, dollars, input);
    }
    return users;
  });
}
