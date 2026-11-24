/**
 * ===== 테스트 코드 공통 머리말 =====
 * 원본은 testcode.template.ts 이다. 모든 *.spec.ts 의 맨 위에 이 글을 똑같이 둔다. 고칠 때는 원본과 모든 사본을 함께 고친다.
 *
 * [세팅]
 * - 도구: Playwright (TypeScript). 설정은 playwright.config.ts 에 있다.
 * - 파일 이름: NNN-이름.spec.ts. 번호는 읽는 순서일 뿐, 실행 순서를 약속하지 않는다.
 * - 제한 시간: 테스트 하나에 3분 (playwright.config.ts 의 기본값).
 * - 서버: 테스트 전에 웹(Vite)과 API(Express)가 떠 있어야 한다. 이미 떠 있으면 그 서버를 쓴다.
 * - 폴더: common/ 은 화면 동작 묶음, api/ 는 API 도구, fixture/ 는 테스트에 쓰는 값을 만드는 도구다. 만드는 법은 [도구 약속]을 따른다.
 *
 * [의도: 주요 테스트 코드 별 생성 목적]
 * - 테스트 파일 하나는 목적 하나를 가진다. 그 목적을 test() 의 제목에 한 줄로 쓴다.
 * - 파일은 서로 독립이다. 다른 파일의 결과나 실행 순서에 기대지 않는다. 그래서 파일들을 병렬로 돌릴 수 있어야 한다.
 * - 공통 준비(로그인 등)는 common/ 코드로 한다. 그 기능 자체의 시험은 그 기능의 파일 하나만 맡는다. (예: 회원가입은 000-auth 만 시험한다)
 *
 * [설계 공통]
 * - 시작: goToMain 으로 자기 계정을 준비하고 Main 에서 시작한다. 시험에 필요한 데이터는 자기가 만든다.
 * - 판정: 한 동작을 화면(UI expect)과 서버(API expect) 두 곳에서 본다. 둘 다 맞아야 통과한다.
 * - 속도: 소량은 화면으로 한다. 대량(연속 생성, 연속 삭제)은 API로 하고, 화면은 그 결과를 읽을 수 있는지만 본다.
 * - 삭제: 앱의 화면 삭제는 숨김(soft delete)이다. 있음/없음은 visible 을 생각해서 본다. 완전 삭제는 API 도구로 한다.
 * - 값: 입력 값은 무작위로 만든다. 경계값은 따로 정해서 시험한다.
 * - 실패: 도구는 자기 동작이 됐는지 스스로 확인하므로, 실패한 줄이 곧 원인 지점이다.
 *
 * [도구 약속] (api/, common/, fixture/ 에 도구를 만들 때 지킨다. 기존 도구는 손볼 때 맞춘다)
 * - 받는 것: 첫 번째 인자는 언제나 page 다. API 요청은 page.request 로 보낸다. 따로 떨어진 request 는 쓰지 않는다.
 * - 판정: 동작 도구(만들기, 지우기, 입금 등)는 그 동작이 됐는지만 확인한다. 그 밖의 판정은 이름이 expect 로 시작하는 도구나 spec 의 expect 줄에 둔다.
 * - 돌려주는 것: 만드는 도구는 만든 것(id 포함)을, 읽는 도구는 읽은 값을 돌려준다. 값이 여럿이면 순서가 아니라 이름 붙은 묶음({ A, B, C })으로 돌려준다.
 * - 이름: 동사로 시작한다(create, get, delete, expect 등). API 도구는 끝에 WithApi, 화면 판정 도구는 끝에 OnScreen 을 붙인다. 화면 동작 도구는 붙이지 않는다.
 * - 단계: 도구의 몸체를 test.step("[종류] 도구 이름", ...) 으로 감싼다. 종류는 common, api, fixture 중 하나다. 기록기가 이 단계로 도구별 성공/실패를 모은다.
 * - 예외: 값만 만드는 함수(fixture/ 의 random 등)는 page 를 받지 않고 단계로 감싸지 않는다.
 * ===== 공통 머리말 끝 =====
 */

import { test, expect } from "@playwright/test";
import { createUsersWithApi } from "./api/create-users";
import {
  getMyTransactionsWithApi,
  myTransactionsUrl,
  TransactionFilter,
} from "./api/get-my-transactions";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { loginWithApi } from "./api/login";
import { transferWithApi } from "./api/transfer";
import { signIn } from "./common/signin";
import {
  applyAmountFilter,
  fillAmountFilter,
  fillDateFilter,
  openMyTransactions,
} from "./common/transaction-filter";
import { random } from "./fixture/random";
import { fixtureValue, runFixtures } from "./fixture/run-fixtures";

const START_DOLLARS = 1000; // 세 사람이 처음에 계좌에 넣은 돈. 이 입금도 거래 목록에 한 건으로 나온다
const MAX_CENTS = 2_147_483_647; // 금액 필터가 받는 최대 (센트 칸이 담을 수 있는 크기)
const DAY = 24 * 60 * 60 * 1000;

// 오늘부터 days일 뒤의 날짜 ("YYYY-MM-DD", 이 컴퓨터의 시간대)
const dayFromToday = (days: number) => {
  const date = new Date(Date.now() + days * DAY);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
};

test("5. 거래 목록 필터: 범위 안의 거래만 보이고, 잘못된 범위는 화면과 서버 모두에서 거절된다", async ({
  page,
}) => {
  // 준비 (API): A가 B와 C에게 보내고, B와 C에게서 받는다. 금액은 구간 안에서 무작위다.
  //   작은 구간은 $10~$90, 큰 구간은 $250~$390. A의 목록은 이 4건과 처음 입금 1건, 모두 5건이다
  //   정식 실행이면 이 번호의 Fixture 값으로, 번호 없는 실행이면 무작위 값으로 만든다
  const { A, B, C } = await createUsersWithApi(
    page,
    ["B", "C", "A"],
    START_DOLLARS,
    "transaction-filter"
  );
  const fixtures = runFixtures("transaction-filter");
  const dollarsOf = (item: string, min: number, max: number) =>
    fixtures ? Number(fixtureValue(fixtures, item)) : random(min, max);
  const sentSmall = await transferWithApi(page, A, B, dollarsOf("sentSmallDollars", 10, 90));
  const sentBig = await transferWithApi(page, A, C, dollarsOf("sentBigDollars", 250, 390));
  await loginWithApi(page, B.user);
  const gotSmall = await transferWithApi(page, B, A, dollarsOf("gotSmallDollars", 10, 90));
  await loginWithApi(page, C.user);
  const gotBig = await transferWithApi(page, C, A, dollarsOf("gotBigDollars", 250, 390));
  const transfers = [sentSmall, sentBig, gotSmall, gotBig];

  // ============================================================================================
  // API: 경계값 분석. 경계와 그 바로 옆(1센트, 1밀리초)을 모두 본다.
  // 표마다 서버의 답을 모아 한 번에 비교한다. 틀리면 어느 줄이 틀렸는지 그대로 보인다
  // ============================================================================================
  await loginWithApi(page, A.user);
  const all = await getMyTransactionsWithApi(page);
  expect(all.length).toBe(5);
  const opening = all.find((item) => transfers.every((sent) => sent.id !== item.id))!; // 처음 입금

  // 이 필터를 걸었을 때 이 거래가 목록에 있는가
  const isListed = async (id: string, filter: TransactionFilter) =>
    (await getMyTransactionsWithApi(page, filter)).some((item) => item.id === id);

  // 1) 금액의 경계: 거래 금액과 그 1센트 아래, 위를 최소와 최대에 넣는다 (양 끝은 포함이다)
  for (const [kind, transaction] of [
    ["withdrawal", sentBig],
    ["deposit", gotBig],
  ] as const) {
    const cents: number = transaction.amount;
    const expected: [number, number, boolean][] = [
      [cents - 1, MAX_CENTS, true],
      [cents, MAX_CENTS, true],
      [cents + 1, MAX_CENTS, false],
      [0, cents - 1, false],
      [0, cents, true],
      [0, cents + 1, true],
      [cents, cents, true],
    ];
    const answered: typeof expected = [];
    for (const [min, max] of expected) {
      const listed = await isListed(transaction.id, { [`${kind}Min`]: min, [`${kind}Max`]: max });
      answered.push([min, max, listed]);
    }
    expect(answered).toEqual(expected);
  }

  // 2) 날짜의 경계: 거래 시각과 그 1밀리초 앞, 뒤를 시작과 끝에 넣는다 (양 끝은 포함이다)
  const at = new Date(sentBig.createdAt).getTime();
  const iso = (time: number) => new Date(time).toISOString();
  const datesExpected: [TransactionFilter, boolean][] = [
    [{ dateRangeStart: iso(at - 1) }, true],
    [{ dateRangeStart: iso(at) }, true],
    [{ dateRangeStart: iso(at + 1) }, false],
    [{ dateRangeEnd: iso(at - 1) }, false],
    [{ dateRangeEnd: iso(at) }, true],
    [{ dateRangeEnd: iso(at + 1) }, true],
    [{ dateRangeStart: iso(at), dateRangeEnd: iso(at) }, true],
  ];
  const datesAnswered: typeof datesExpected = [];
  for (const [filter] of datesExpected) {
    datesAnswered.push([filter, await isListed(sentBig.id, filter)]);
  }
  expect(datesAnswered).toEqual(datesExpected);
  //    이 시각부터 걸면 앞에 있던 거래와 처음 입금은 빠지고, 이 거래와 뒤의 거래만 남는다
  const since = await getMyTransactionsWithApi(page, { dateRangeStart: iso(at) });
  expect(since.map((item) => item.id).sort()).toEqual([sentBig.id, gotSmall.id, gotBig.id].sort());

  // 3) 입력의 경계: 받는 값(200)과 거절하는 값(422)의 바로 옆을 본다
  const inputsExpected: [TransactionFilter, number][] = [
    // 금액 (센트): 0부터 최대까지
    [{ withdrawalMin: -1 }, 422],
    [{ withdrawalMin: 0 }, 200],
    [{ withdrawalMin: MAX_CENTS }, 200],
    [{ withdrawalMin: MAX_CENTS + 1 }, 422],
    [{ withdrawalMin: "10.5" }, 422],
    // 최소와 최대: 같으면 되고, 최소가 1센트라도 크면 안 된다
    [{ depositMin: 500, depositMax: 500 }, 200],
    [{ depositMin: 501, depositMax: 500 }, 422],
    // 시작과 끝: 같으면 되고, 시작이 1밀리초라도 늦으면 안 된다
    [{ dateRangeStart: iso(at), dateRangeEnd: iso(at) }, 200],
    [{ dateRangeStart: iso(at + 1), dateRangeEnd: iso(at) }, 422],
    // 있는 날짜와 없는 날짜: 달의 끝, 윤년(2028)과 평년(2027)의 2월, 30일까지인 달
    [{ dateRangeStart: "2027-02-28" }, 200],
    [{ dateRangeStart: "2028-02-29" }, 200],
    [{ dateRangeStart: "2027-12-31" }, 200],
    [{ dateRangeStart: "2027-13-01" }, 422],
    [{ dateRangeStart: "2027-02-29" }, 422],
    [{ dateRangeStart: "2028-02-30" }, 422],
    [{ dateRangeStart: "2027-04-31" }, 422],
    [{ dateRangeEnd: "2027-02-29T00:00:00.000Z" }, 422],
  ];
  const inputsAnswered: typeof inputsExpected = [];
  for (const [filter] of inputsExpected) {
    const response = await page.request.get(myTransactionsUrl(filter));
    inputsAnswered.push([filter, response.status()]);
  }
  expect(inputsAnswered).toEqual(inputsExpected);

  // 4) 각자의 관점: A의 출금은 B와 C에게 입금이고, A의 입금은 B와 C의 출금이다. 남의 거래는 목록에 없다
  const exactly = (kind: string, cents: number): TransactionFilter => ({
    [`${kind}Min`]: cents,
    [`${kind}Max`]: cents,
  });
  for (const [who, received, paid] of [
    [B, sentSmall, gotSmall],
    [C, sentBig, gotBig],
  ] as const) {
    await loginWithApi(page, who.user);
    const mine = (await getMyTransactionsWithApi(page)).map((item) => item.id);
    expect(mine.length).toBe(3); // 받은 것, 보낸 것, 자기의 처음 입금
    const others = transfers.filter((item) => item.id !== received.id && item.id !== paid.id);
    expect(others.some((item) => mine.includes(item.id))).toBe(false);
    expect(await isListed(received.id, exactly("deposit", received.amount))).toBe(true);
    expect(await isListed(received.id, exactly("withdrawal", received.amount))).toBe(false);
    expect(await isListed(paid.id, exactly("withdrawal", paid.amount))).toBe(true);
    expect(await isListed(paid.id, exactly("deposit", paid.amount))).toBe(false);
  }

  // ============================================================================================
  // 화면: 동등분할. 구간마다 대표 하나만 눈에 보이게 거른다 (A의 화면)
  // ============================================================================================
  await page.goto("/signin");
  await signIn(page, A.user);
  await expect(page).toHaveURL("/");
  await openMyTransactions(page);

  // 목록에 이 거래들만 보이는가 (하나도 없으면 빈 목록 안내가 보인다)
  const expectListOnScreen = async (items: { id: string }[]) => {
    for (const item of items) {
      await expect(page.getByTestId(`transaction-item-${item.id}`)).toBeVisible();
    }
    await expect(page.locator("[data-testid^=transaction-item-]")).toHaveCount(items.length);
    if (items.length === 0) await expect(page.getByTestId("empty-list-header")).toBeVisible();
  };
  const everything = [opening, ...transfers];
  await expectListOnScreen(everything);

  // 5) 금액 구간: 작은 금액, 큰 금액, 해당 없음 (출금과 입금)
  for (const [kind, small, big] of [
    ["withdrawal", sentSmall, sentBig],
    ["deposit", gotSmall, gotBig],
  ] as const) {
    await applyAmountFilter(page, kind, { min: "1", max: "100" });
    await expectListOnScreen([small]);
    await applyAmountFilter(page, kind, { min: "200", max: "400" });
    await expectListOnScreen([big]);
    await applyAmountFilter(page, kind, { min: "500", max: "600" });
    await expectListOnScreen([]);
    await applyAmountFilter(page, kind, { min: "", max: "" }); // 필터를 없애면 다시 모두 보인다
    await expectListOnScreen(everything);
  }

  // 6) 잘못된 금액 구간: 최소가 더 큼, 소수, 한도 초과. 안내가 나오고 적용 버튼이 꺼진다
  for (const [min, max, message] of [
    ["100", "50", "최소 금액이 최대 금액보다 클 수 없습니다"],
    ["10.5", "", "숫자(정수)만 입력하세요"],
    ["21474837", "", "21,474,836 이하로 입력하세요"],
  ]) {
    await fillAmountFilter(page, "withdrawal", { min, max });
    await expect(page.getByTestId("transaction-list-filter-withdrawal-message")).toHaveText(
      message
    );
    await expect(
      page.getByTestId("transaction-list-filter-withdrawal-apply-button")
    ).toBeDisabled();
    await page.getByTestId("transaction-list-filter-withdrawal-reset-button").click();
    await expect(page.getByTestId("transaction-list-filter-withdrawal")).toBeHidden();
    await expectListOnScreen(everything);
  }

  // 7) 날짜 구간: 미래 구간은 없음, 오늘이 든 구간은 모두 (어제와 내일로 잡아 자정에도 흔들리지 않는다)
  await fillDateFilter(page, dayFromToday(10), dayFromToday(20));
  await expectListOnScreen([]);
  await fillDateFilter(page, dayFromToday(-1), dayFromToday(1));
  await expectListOnScreen(everything);

  // 8) 잘못된 날짜 구간: 시작이 늦음, 없는 날짜, 덜 쓴 날짜. 안내가 나온다
  for (const [start, end, message] of [
    ["2027-03-02", "2027-03-01", "시작일이 종료일보다 늦을 수 없습니다"],
    ["2027-02-30", "", "시작일: 존재하지 않는 날짜입니다"],
    ["2027-02", "", "시작일의 연·월·일을 모두 입력하세요"],
  ]) {
    await fillDateFilter(page, start, end);
    await expect(page.getByTestId("transaction-list-filter-date-message")).toHaveText(message);
  }
  await page.getByTestId("transaction-list-filter-date-clear-button").click();
  await expect(page.getByTestId("transaction-list-filter-date-message")).toBeHidden();
  await expectListOnScreen(everything);

  // 정리: 세 사람의 은행 계좌를 API로 완전히 지운다 (거래를 지우는 API는 없어서 거래 기록은 남는다)
  for (const who of [A, B, C]) {
    await loginWithApi(page, who.user);
    await hardDeleteBankAccountsWithApi(page);
  }
});
