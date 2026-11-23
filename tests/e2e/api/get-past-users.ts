import { expect, Page, test } from "@playwright/test";
import { pickNearestRuns } from "../fixture/pick-runs";
import { RandomUser } from "../fixture/random-user";
import { fixtureValue } from "../fixture/run-fixtures";

/** 지난 실행 번호의 A. 003이 가입시키고 남겨 둔 사람이다 */
export interface PastUser {
  name: string; // 예: "A239"
  ageDays: number; // 실제 나이 (일)
  user: RandomUser; // 그 번호의 Fixture 값: 가입할 때의 정보와 로그인에 쓰는 값
}

/**
 * API 도구: 바란 나이(일)마다 가장 가까운 지난 실행 번호를 골라 그 번호의 A를 돌려준다.
 * 번호와 값은 번호 서버(GET /api/testRuns)에 묻는다. Web이 끝까지 돈 번호만, Blocked는 빼고 고른다.
 * 번호 서버를 쓸 수 없는 곳(비밀 값이 없는 시연, 번호 기능이 닫힌 서버)에서는 undefined 를 돌려준다.
 */
export async function getPastUsersWithApi(
  page: Page,
  ages: readonly number[]
): Promise<PastUser[] | undefined> {
  return test.step("[api] getPastUsersWithApi", async () => {
    const secret = process.env.TEST_RUN_SECRET;
    if (!secret) return undefined;
    const url = `${process.env.TEST_RUN_SERVER ?? ""}/api/testRuns`;
    const headers = { Authorization: `Bearer ${secret}` };

    const list = await page.request.get(url, { headers });
    if (list.status() === 404) return undefined; // 번호 기능이 닫힌 서버
    expect(list.status()).toBe(200);
    const runs: {
      runNo: number;
      createdAt: string;
      status: string;
      platformRuns: { platform: string; status: string }[];
    }[] = (await list.json()).runs;
    const usable = runs.filter(
      (run) =>
        run.status === "open" &&
        run.platformRuns.some((web) => web.platform === "web" && web.status === "finished")
    );

    const past: PastUser[] = [];
    for (const { runNo, ageDays } of pickNearestRuns(usable, ages)) {
      const read = await page.request.get(`${url}/${runNo}/fixtures?platform=web`, { headers });
      expect(read.status()).toBe(200);
      const transfer = (await read.json()).fixtures.transfer;
      const of = (item: string) => fixtureValue(transfer, `A.${item}`);
      past.push({
        name: `A${runNo}`,
        ageDays,
        user: {
          lastName: of("lastName"),
          firstName: of("firstName"),
          username: of("username"),
          phoneNumber: of("phoneNumber"),
          password: of("password"),
        },
      });
    }
    return past;
  });
}
