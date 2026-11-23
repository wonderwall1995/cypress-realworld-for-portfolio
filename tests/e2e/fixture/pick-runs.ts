import { random } from "./random";

/** 실행 번호 하나와 그 번호를 연 때 */
export interface RunInfo {
  runNo: number;
  createdAt: string;
}

export interface PickedRun {
  runNo: number;
  ageDays: number; // 실제 나이 (일). 바란 나이와 다를 수 있다
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Fixture 코드: 바란 나이(일)마다 가장 가까운 실행 번호를 하나씩, 서로 다르게 고른다.
 * 비슷하게 가까운 번호(바란 나이의 10% 안쪽 차이)가 여럿이면 그중 무작위다.
 * 번호가 바란 나이보다 적으면 있는 만큼만 고른다. 실제 나이를 함께 돌려주므로 얼마나 오래됐는지 속이지 않는다.
 */
export const pickNearestRuns = (
  runs: readonly RunInfo[],
  ages: readonly number[],
  now: number = Date.now()
): PickedRun[] => {
  const left = runs.map((run) => ({
    runNo: run.runNo,
    ageDays: (now - new Date(run.createdAt).getTime()) / DAY,
  }));
  const picked: PickedRun[] = [];
  // 오래된 나이부터 고른다: 번호가 적을 때 가장 오래된 번호가 가장 먼 나이의 몫이 된다
  for (const age of [...ages].sort((a, b) => b - a)) {
    if (left.length === 0) break;
    const distance = (run: PickedRun) => Math.abs(run.ageDays - age);
    const best = Math.min(...left.map(distance));
    const near = left.filter((run) => distance(run) <= best + age * 0.1);
    const chosen = near[random(0, near.length - 1)];
    picked.push(chosen);
    left.splice(left.indexOf(chosen), 1);
  }
  return picked;
};
