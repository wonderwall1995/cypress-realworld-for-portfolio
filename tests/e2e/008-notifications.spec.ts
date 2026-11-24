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
import { getMyNotificationsWithApi, NotificationInfo } from "./api/get-my-notifications";
import { hardDeleteBankAccountsWithApi } from "./api/hard-delete-bank-accounts";
import { loginWithApi } from "./api/login";
import { transferWithApi } from "./api/transfer";
import { mockNotificationsOnPage, unmockNotificationsOnPage } from "./common/mock-notifications";
import { confirmNotification, openNotifications } from "./common/notifications";
import { signIn } from "./common/signin";
import { random } from "./fixture/random";

const START_DOLLARS = 1000; // 세 사람이 처음에 계좌에 넣은 돈
const MAX_BADGE = 99; // 종에 숫자로 보이는 최대 개수. 넘으면 "99+"로 보인다

const UNREAD_OPACITY = "1"; // 읽지 않은 알림은 또렷하고,
const READ_OPACITY = "0.65"; // 읽은 알림은 흐리다

// 알림의 종류
const kindOf = (item: NotificationInfo) => {
  if (item.commentId) return "댓글";
  if (item.likeId) return "좋아요";
  return item.status === "received" ? "받은 이체" : "모르는 알림";
};

test("8. 알림: 일어난 일이 맞는 사람에게 알려지고, 확인하면 흐려져 남으며, 종은 안 읽은 것만 99까지 센다", async ({
  page,
}) => {
  // 준비 (API): 세 사람을 만든다. 새 사람이라 알림이 없다
  const { A, B, C } = await createUsersWithApi(page, ["A", "C", "B"], START_DOLLARS);

  // ============================================================================================
  // API: 실제로 알림을 일으키고, 누구에게 무엇이 왔는지 본다
  // ============================================================================================
  // 1) B가 A에게 보낸다. 그 거래에 관계없는 C가 좋아요를 누르고 댓글을 쓴다
  await loginWithApi(page, B.user);
  const sent = await transferWithApi(page, B, A, random(1, 100), "알림 시험", "public");
  await loginWithApi(page, C.user);
  const liked = await page.request.post(`/api/likes/${sent.id}`);
  expect(liked.status()).toBe(200);
  const commented = await page.request.post(`/api/comments/${sent.id}`, {
    data: { content: "알림을 일으키는 댓글" },
  });
  expect(commented.status()).toBe(200);

  // 2) 서버 판정: 받은 이체는 받은 A에게만, 좋아요와 댓글은 거래한 두 사람에게 온다. 누른 C에게는 오지 않는다
  //    알림마다 일으킨 사람의 이름과 그 거래가 맞다 (새것부터)
  const nameOf = ({ user }: typeof A) => `${user.lastName} ${user.firstName}`;
  const about = (kind: string, who: typeof A) => ({ kind, name: nameOf(who), on: sent.id });
  const received: Record<string, object[]> = {};
  for (const [name, who] of Object.entries({ B, C, A })) {
    await loginWithApi(page, who.user);
    received[name] = (await getMyNotificationsWithApi(page)).map((item) => ({
      kind: kindOf(item),
      name: item.userFullName,
      on: item.transactionId,
    }));
  }
  expect(received).toEqual({
    A: [about("댓글", C), about("좋아요", C), about("받은 이체", B)],
    B: [about("댓글", C), about("좋아요", C)],
    C: [],
  });

  // 3) 거절: 남의 알림은 읽음으로 바꿀 수 없다 (서버만). 남의 알림은 없는 알림과 같다 (404)
  const [comment, like, payment] = await getMyNotificationsWithApi(page); // 지금 로그인은 A다
  await loginWithApi(page, C.user);
  for (const item of [comment, like, payment]) {
    const refused = await page.request.patch(`/api/notifications/${item.id}`, {
      data: { isRead: true },
    });
    expect(refused.status()).toBe(404);
  }
  await loginWithApi(page, A.user);
  expect((await getMyNotificationsWithApi(page)).length).toBe(3);

  // ============================================================================================
  // 화면: A의 종과 알림 목록
  // ============================================================================================
  const bell = page.getByTestId("nav-top-notifications-count");
  const items = page.locator('[data-testid^="notification-list-item-"]');
  const itemOf = ({ id }: NotificationInfo) => page.getByTestId(`notification-list-item-${id}`);
  const confirmOf = ({ id }: NotificationInfo) => page.getByTestId(`notification-mark-read-${id}`);
  // 읽은 알림: 목록에 남아 있고, 흐리고, "확인"이 없다. 읽지 않은 알림: 또렷하고 "확인"이 있다
  const expectRead = async (item: NotificationInfo) => {
    await expect(itemOf(item)).toHaveCSS("opacity", READ_OPACITY);
    await expect(itemOf(item)).toBeVisible();
    await expect(confirmOf(item)).toHaveCount(0);
  };
  const expectUnread = async (item: NotificationInfo) => {
    await expect(itemOf(item)).toHaveCSS("opacity", UNREAD_OPACITY);
    await expect(confirmOf(item)).toBeVisible();
  };

  // 4) A가 화면에서 로그인하면 종은 3이고, 목록에 누가 무엇을 했는지 보인다
  await page.goto("/signin");
  await signIn(page, A.user);
  await expect(page).toHaveURL("/");
  await expect(bell).toHaveText("3");
  await openNotifications(page);
  await expect(items).toHaveCount(3);
  await expect(itemOf(payment)).toContainText(`${nameOf(B)}님이 이체했습니다.`);
  await expect(itemOf(like)).toContainText(`${nameOf(C)}님이 거래에 좋아요를 눌렀습니다.`);
  await expect(itemOf(comment)).toContainText(`${nameOf(C)}님이 거래에 댓글을 남겼습니다.`);
  await expectUnread(payment);
  await expectUnread(like);
  await expectUnread(comment);

  // 5) 통신 중에 누른 "확인"도 잃지 않는다. 알림의 통신을 모두 붙잡아 두고 두 개를 잇달아 누른다
  //    첫 번째는 목록을 다시 읽는 중에(화면을 나갔다 오면 다시 읽는다), 두 번째는 첫 번째를 저장하는 중에 누른 것이 된다
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/notifications**", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByTestId("sidenav-home").click();
  await expect(page).toHaveURL("/");
  await openNotifications(page);
  await confirmOf(payment).click();
  await confirmOf(like).click();
  await expect(bell).toHaveText("3"); // 아직 아무 답도 오지 않았다
  //    통신을 풀면 두 개가 모두 저장되어, 사라지지 않고 흐려진다. 종은 안 읽은 하나만 센다
  release();
  await expectRead(payment);
  await expectRead(like);
  await expect(bell).toHaveText("1");
  await page.unroute("**/api/notifications**");
  await page.reload();
  await expect(bell).toHaveText("1");
  //    새로고침해도 셋이 그대로 보이고, 읽은 것과 안 읽은 것이 구별된다
  await expect(items).toHaveCount(3);
  await expectRead(payment);
  await expectRead(like);
  await expectUnread(comment);
  //    서버도 같다: 안 읽은 것은 하나이고, 읽은 것까지 달라고 하면 생긴 순서 그대로 셋이 온다
  const unread = await getMyNotificationsWithApi(page);
  expect(unread.map((item) => item.id)).toEqual([comment.id]);
  const history = await getMyNotificationsWithApi(page, "read");
  expect(history.map(({ id, isRead }) => ({ id, isRead }))).toEqual([
    { id: comment.id, isRead: false },
    { id: like.id, isRead: true },
    { id: payment.id, isRead: true },
  ]);

  // ============================================================================================
  // 모킹: 알림 99개와 100개는 실제로 만들기 힘들다. 화면이 받는 답만 가짜로 바꿔 종의 경계를 본다
  // ============================================================================================
  // 6) 99개는 "99", 100개는 "99+"로 보인다. 목록에는 모두 보인다
  for (const [count, text] of [
    [MAX_BADGE, "99"],
    [MAX_BADGE + 1, "99+"],
  ] as const) {
    await mockNotificationsOnPage(page, count);
    await page.reload();
    await expect(bell).toHaveText(text);
    await expect(items).toHaveCount(count);
  }
  //    하나도 없으면 "0"과 빈 목록 안내가 보인다 (화면을 나갔다 오면 다시 읽는다)
  await mockNotificationsOnPage(page, 0);
  await page.getByTestId("sidenav-home").click();
  await expect(page).toHaveURL("/");
  await openNotifications(page);
  await expect(items).toHaveCount(0);
  await expect(bell).toHaveText("0");
  await expect(page.getByTestId("empty-list-header")).toContainText("알림 내역이 없습니다");
  //    가짜는 화면에만 있다. 서버의 안 읽은 알림은 그대로 하나다
  expect((await getMyNotificationsWithApi(page)).length).toBe(1);

  // 7) 모킹을 끝내면 화면은 다시 진짜 셋을 보여 준다. 남은 하나까지 확인하면 종은 0이고, 셋 다 흐려져 남는다
  await unmockNotificationsOnPage(page);
  await page.reload();
  await expect(bell).toHaveText("1");
  await confirmNotification(page, comment.id);
  await expect(bell).toHaveText("0");
  await expect(items).toHaveCount(3);
  for (const item of [comment, like, payment]) {
    await expectRead(item);
  }
  expect((await getMyNotificationsWithApi(page)).length).toBe(0);

  // 8) 읽은 알림도 남에게는 보이지 않는다 (서버). C에게는 아무것도 없다
  await loginWithApi(page, C.user);
  expect((await getMyNotificationsWithApi(page, "read")).length).toBe(0);

  // 정리: 세 사람의 은행 계좌를 API로 완전히 지운다 (거래와 알림을 지우는 API는 없어서 기록은 남는다)
  for (const who of [A, B, C]) {
    await loginWithApi(page, who.user);
    await hardDeleteBankAccountsWithApi(page);
  }
});
