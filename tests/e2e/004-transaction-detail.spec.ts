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
import { getCommentsWithApi } from "./api/get-comments";
import { getLikesWithApi } from "./api/get-likes";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { loginWithApi } from "./api/login";
import { transferWithApi } from "./api/transfer";
import { signIn } from "./common/signin";
import { likeTransaction, openTransactionDetail, writeComment } from "./common/transaction-detail";
import { random } from "./fixture/random";
import { randomComment } from "./fixture/random-comment";
import { fixtureValue, runFixtures } from "./fixture/run-fixtures";

const GRAY = "rgba(0, 0, 0, 0.54)"; // 누르지 않은 좋아요
const BLUE = "rgb(25, 118, 210)"; // 내가 누른 좋아요
const START_DOLLARS = 1000; // 두 사람이 처음에 각자 계좌에 가진 돈

test("4. 거래 상세: 좋아요와 댓글이 화면과 서버에서 같고, 중복 좋아요와 빈 댓글은 거절된다", async ({
  page,
}) => {
  // 준비 (API): 받는 사람 B를 먼저, 보내는 사람 A를 마지막에 만든다. 준비가 끝나면 브라우저의 로그인은 A다.
  //   이체 자체는 003이 시험하므로, 여기서는 상세를 볼 거래 하나를 API로 빠르게 만든다
  //   정식 실행이면 이 번호의 Fixture 값으로, 번호 없는 실행이면 무작위 값으로 만든다
  const { A, B } = await createUsersWithApi(page, ["B", "A"], START_DOLLARS, "transaction-detail");
  const fixtures = runFixtures("transaction-detail");
  const dollars = fixtures ? Number(fixtureValue(fixtures, "dollars")) : random(1, 500);
  const text = fixtures ? fixtureValue(fixtures, "comment") : randomComment();
  const noMemo = await transferWithApi(page, A, B, 1, ""); // 메모를 비운 이체
  const transaction = await transferWithApi(page, A, B, dollars, "거래 상세 시험");
  const id: string = transaction.id;

  // A가 화면에서 로그인하고 거래 상세를 연다 (공통 코드). 새 거래라 좋아요도 댓글도 없다
  await page.goto("/signin");
  await signIn(page, A.user);
  await expect(page).toHaveURL("/");
  await openTransactionDetail(page, id);
  const likeCount = page.getByTestId(`transaction-like-count-${id}`);
  const commentItems = page.locator("[data-testid^=comment-list-item-]");
  await expect(likeCount).toHaveText("0");
  await expect(commentItems).toHaveCount(0);

  // 1) 좋아요 (누르기 전에는 강조하지 않고, 누르면 강조한다)
  const likeButton = page.getByTestId(`transaction-like-button-${id}`);
  await expect(likeButton).toHaveCSS("color", GRAY);
  //    화면: 누르면 버튼이 꺼지고(공통 코드) 개수가 1이 된다
  await likeTransaction(page, id);
  await expect(likeButton).toHaveCSS("color", BLUE);
  await expect(likeCount).toHaveText("1");
  //    서버: 좋아요가 하나이고, 누른 사람이 A다
  const likes = await getLikesWithApi(page, id);
  expect(likes.map((like) => like.userId)).toEqual([A.user.id]);

  // 2) 거절: 중복 좋아요 (서버만)
  //    화면은 버튼이 꺼져 있어 두 번 누를 수 없다. 요청을 직접 보내도 서버가 거절하고(409) 좋아요는 그대로 하나다
  const likedAgain = await page.request.post(`/api/likes/${id}`);
  expect(likedAgain.status()).toBe(409);
  expect((await getLikesWithApi(page, id)).length).toBe(1);

  // 3) 댓글
  //    화면: 쓰고 Enter를 누르면 목록에 보인다(공통 코드). 댓글은 하나다
  await writeComment(page, id, text);
  await expect(commentItems).toHaveCount(1);
  //    서버: 댓글이 하나이고, 내용과 쓴 사람(이름까지)이 같다
  const comments = await getCommentsWithApi(page, id);
  const writer = `${A.user.lastName} ${A.user.firstName}`;
  expect(
    comments.map(({ userId, content, userFullName }) => ({ userId, content, userFullName }))
  ).toEqual([{ userId: A.user.id, content: text, userFullName: writer }]);
  //    화면: 댓글 아래에 쓴 사람과 쓴 시각이 보인다
  await expect(page.getByTestId(`comment-author-${comments[0].id}`)).toHaveText(writer);
  await expect(page.getByTestId(`comment-time-${comments[0].id}`)).toContainText(":");

  // 4) 거절: 빈 댓글
  //    화면: 빈 칸과 공백에서 Enter를 누르면 안내가 나오고, 댓글은 늘지 않는다
  const commentInput = page.getByTestId(`transaction-comment-input-${id}`);
  for (const blank of ["", "   "]) {
    await commentInput.fill(blank);
    await commentInput.press("Enter");
    await expect(page.locator(`#transaction-comment-input-${id}-helper-text`)).toHaveText(
      "댓글을 입력하세요"
    );
    await expect(commentItems).toHaveCount(1);
    //  서버: 같은 값을 직접 보내도 입력 검사에서 거절한다 (422)
    const refused = await page.request.post(`/api/comments/${id}`, { data: { content: blank } });
    expect(refused.status()).toBe(422);
  }
  expect((await getCommentsWithApi(page, id)).length).toBe(1);

  // 5) 새로고침: 거절된 요청들이 지나간 뒤에도 화면은 서버와 같다 (좋아요 1개, 댓글 1개)
  await page.reload();
  await expect(likeCount).toHaveText("1");
  await expect(commentItems).toHaveCount(1);

  // 6) 메모를 비운 거래의 상세에는 메모 줄이 없다
  await expect(page.getByTestId("transaction-description")).toHaveCount(1);
  await openTransactionDetail(page, noMemo.id);
  await expect(page.getByTestId("transaction-description")).toHaveCount(0);

  // 정리: 두 사람의 은행 계좌를 API로 완전히 지운다 (거래를 지우는 API는 없어서 거래 기록은 남는다)
  for (const who of [A, B]) {
    await loginWithApi(page, who.user);
    await hardDeleteBankAccountsWithApi(page);
  }
});
