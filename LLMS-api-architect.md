# LLMS-api-architect

API 서버(`apps/api`)의 설계 매뉴얼이다. 새 기능을 만들거나 고칠 때 이 문서의 규칙을 따른다.
코드를 읽고 쓴 것이다. 기준일은 2026-11-12이다.

- 작업 기록은 `LLMS.md`(Done)에 있다. 이 문서는 "어떻게 설계되어 있고, 무엇을 지켜야 하는가"만 다룬다.
- 이 저장소는 공개 상태다. 비밀 값(키, 비밀번호, 세션 비밀)은 이 문서에 쓰지 않는다.
- 보안 점검 항목은 이름만 적는다. 자세한 내용은 공개 전 점검 때 따로 다룬다.

---

## 1. 모노레포 구성

```
apps/web         @rwa/web      React + Vite       (포트 7201)
apps/api         @rwa/api      Express + Prisma   (포트 7202)
packages/shared  @rwa/shared   모델 타입 + 거래 유틸 (소스 그대로 사용, 빌드 없음)
루트             e2e, Playwright, Docker, 공통 도구, 문서, .env
```

- 의존 방향은 `web → shared ← api` 이다.
- web과 api는 서로를 import하지 않는다.
- API와 web이 같이 쓰는 타입과 규칙(금액 한도, 계좌번호 형식, 외부 입금 상수, 입출금 방향 판정)은 전부 `@rwa/shared`에 둔다.
- `.env`는 루트에 한 개만 둔다. API는 `src/load-env.ts`가 읽는다.

## 2. 실행 구조

- 브라우저와 모바일 WebView는 web(7201)에만 접속한다. `/api` 요청은 Vite 프록시가 API(7202)로 넘긴다.
- 그래서 브라우저 입장에서는 같은 출처(same-origin)이다.
- Docker는 컨테이너 두 개를 쓴다. `rwa-app`(web + api)과 `rwa-postgres`이다.
- API 시작 명령은 `ts-node --files src/app.ts` 이다. `--files`가 있어야 `req.user` 타입이 보인다.
- 7202 포트가 이미 쓰이고 있으면, API는 빈 포트로 옮겨서 켜고 경고를 출력한다.
- 서버가 SIGINT/SIGTERM을 받으면 열린 실시간 알림 연결을 모두 닫고 끝낸다 (`app.ts`).

## 3. 요청이 지나가는 순서

`app.ts` 기준이다. 위에서 아래로 실행된다.

1. CORS (허용 출처: `http://localhost:<web 포트>`, 쿠키 허용)
2. 요청 로그 (morgan)
3. 본문 파서 (urlencoded, json)
4. 세션 (express-session, 메모리 저장)
5. passport 초기화와 세션 연결
6. 페이지네이션 (`PAGINATION_PAGE_SIZE`)
7. `/api` 라우터 안에서:
   1. `/testData` (개발과 테스트 모드에서만 열림)
   2. 인증 라우터 (`/login`, `/logout`, `/checkAuth`)
   3. 외부 인증 제공자의 JWT 검사 (환경변수로 켬: Auth0, Okta, Cognito, Google)
   4. 업무 라우터
8. 오류 처리기: `HttpError`는 JSON으로 답한다. 나머지는 Express 기본 처리로 넘긴다.

## 4. 인증

- 기본 방식은 세션 쿠키다. passport의 local 전략으로 사용자명과 비밀번호를 검사한다.
- 비밀번호는 bcrypt 해시로 저장한다. 응답에서는 `omitPassword`로 항상 뺀다.
- 세션 쿠키의 서명 비밀은 `.env`의 `SESSION_SECRET`에서 읽는다 (`session-secret.ts`). 코드에는 값이 없다.
  - 값이 있으면 그대로 쓴다.
  - 값이 없고 production이면 서버가 시작하지 않는다 (32자 이상 필요).
  - 값이 없고 production이 아니면 시작할 때마다 무작위 값을 만든다. 서버를 다시 켜면 모두 로그아웃된다.
- 로그인할 때 `remember`가 참이면 쿠키 수명이 30일이다. 아니면 브라우저를 닫을 때 끝난다.
- 보호할 라우트는 `ensureAuthenticated`를 붙인다. 로그인하지 않았으면 401과 `{ error }`를 답한다.
- 로그아웃은 그 로그인 세션이 연 실시간 알림 연결도 닫는다 (`closeStreamsOfSession`).
- 외부 인증 제공자를 켜면 `Authorization: Bearer` 토큰을 검사한다. `/api/testData/*`는 검사에서 뺀다.
- 모바일 앱용 토큰 인증은 아직 없다. 지금은 쿠키 세션을 WebView에서 쓴다.

### 비밀번호 재확인

돈이 계좌에서 나가는 동작은 로그인만으로 허용하지 않고, 그 사람의 비밀번호를 한 번 더 받는다.

- 이체(`POST /transactions`)는 본문에 `password`를 받고, 서버가 `passwordMatches`로 다시 검사한다. 틀리면 403이다.
- 화면의 "정말 이체하겠습니까?" 단계는 `POST /users/verifyPassword`로 미리 확인한다 (맞으면 204, 틀리면 403).
- 클라이언트의 확인은 편의일 뿐이고, 허용 여부는 항상 서버가 정한다. 새 "돈이 나가는" 동작을 만들면 같은 검사를 서버에 넣는다.

## 5. 엔드포인트

모든 경로 앞에 `/api`가 붙는다. "로그인" 열이 `필요`이면 `ensureAuthenticated`가 붙어 있다.
"권한" 열은 로그인한 사람 중 누가 쓸 수 있는지를 말한다 (규칙은 6절).

| 영역         | 메서드와 경로                                                   | 로그인 | 권한                     | 설명                                                                                                |
| ------------ | --------------------------------------------------------------- | ------ | ------------------------ | --------------------------------------------------------------------------------------------------- |
| 인증         | `POST /login`                                                   | -      | -                        | 로그인                                                                                              |
| 인증         | `POST /logout`                                                  | -      | -                        | 로그아웃 (끝에 `/`로 리다이렉트)                                                                    |
| 인증         | `GET /checkAuth`                                                | -      | -                        | 현재 사용자, 없으면 401                                                                             |
| 사용자       | `POST /users`                                                   | 불필요 | -                        | 회원 가입. 잔액은 항상 0으로 시작한다                                                               |
| 사용자       | `GET /users`, `GET /users/search`                               | 필요   | 누구나                   | 목록, 검색. 비밀번호와 잔액은 뺀다. 검색은 11절 규칙                                                |
| 사용자       | `POST /users/verifyPassword`                                    | 필요   | 본인 비밀번호            | 내 비밀번호가 맞는지 확인. 204 / 403                                                                |
| 사용자       | `GET /users/:userId`                                            | 필요   | 본인만 (아니면 401)      | 내 정보 (잔액 포함)                                                                                 |
| 사용자       | `GET /users/profile/:username`                                  | 불필요 | -                        | 공개 프로필 (이름, 아바타)                                                                          |
| 사용자       | `PATCH /users/:userId`                                          | 필요   | 본인만 (아니면 403)      | 이름, 이메일, 전화, 아바타, 공개 범위(public/private)만 수정. 빈 이메일과 전화는 null로 저장        |
| 은행 계좌    | `GET /bankAccounts`, `GET /bankAccounts/:id`                    | 필요   | 본인 것만                | 조회(숨긴 계좌 제외). 남의 계좌는 "없음"과 같게 답한다                                              |
| 은행 계좌    | `GET /bankAccounts/of-user/:userId`                             | 필요   | 누구나                   | 이체 상대가 고를 계좌 목록. 은행 이름과 끝 4자리만 내려 주고 잔액은 뺀다                            |
| 은행 계좌    | `POST /bankAccounts`, `DELETE /bankAccounts/:id`                | 필요   | 본인 것만 (삭제는 404)   | 생성, 삭제(논리 삭제). 잔액이 남은 계좌는 삭제 400                                                  |
| 거래         | `GET /transactions`                                             | 필요   | 본인 것                  | 내 거래                                                                                             |
| 거래         | `GET /transactions/public`                                      | 필요   | -                        | 전체 거래 (공개 거래 + 내가 당사자인 거래)                                                          |
| 거래         | `GET /transactions/:id`                                         | 필요   | 볼 수 있는 사람만 (404)  | 거래 하나                                                                                           |
| 거래         | `POST /transactions`                                            | 필요   | 본인이 보내는 사람       | 이체. `myAccountId`, `otherAccountId`, `password` 필수. 거래 종류는 `payment` 하나뿐이다            |
| 좋아요, 댓글 | `GET`, `POST /likes/:transactionId`, `/comments/:transactionId` | 필요   | 볼 수 있는 사람만 (404)  | 거래에 붙는다                                                                                       |
| 알림         | `GET /notifications`, `PATCH /notifications/:id`                | 필요   | 본인 것만                | 목록, 읽음 처리                                                                                     |
| 알림         | `GET /notifications/stream`                                     | 필요   | 본인 것만                | 실시간 알림(SSE). 규칙은 10절                                                                       |
| 알림         | `POST /notifications/bulk`                                      | 필요   | 본인 것만                | 알림 여러 개 만들기 (테스트와 점검용)                                                               |
| 은행 입출금  | `GET /bankTransfers`                                            | 필요   | 본인 것                  | 내 입출금 목록                                                                                      |
| 은행 입출금  | `POST /bankTransfers`                                           | 필요   | 본인 계좌만 (아니면 403) | 가상 입금 또는 출금. 입금은 "외부 입금" 거래도 만든다 (8절)                                         |
| 은행 입출금  | `GET /bankTransfers/:id/logs`                                   | 필요   | 본인 것만 (아니면 404)   | 상태 변화 기록                                                                                      |
| GraphQL      | `/graphql`                                                      | 간접   | 본인 계좌만              | 은행 계좌 조회, 생성, 삭제만 지원. 라우트에는 로그인 검사가 없고, 처리기가 사용자를 읽다가 실패한다 |
| 테스트       | `POST /testData/reset`, `/seed`                                 | -      | -                        | 모든 테이블 비우기 (둘이 같은 동작)                                                                 |
| 테스트       | `GET /testData/:entity`                                         | -      | -                        | 테이블 전체 조회                                                                                    |

`/testData`는 `NODE_ENV`가 `test` 또는 `development`일 때만 연결된다.

없는 기능(만들지 않는다): 거래 "요청"과 수락, 연락처(친구), 라우팅 번호. 요청 거래를 만들려고 하면 422이다.

## 6. 코드 계층과 권한 규칙

한 영역은 보통 파일 세 개로 나뉜다.

```
<영역>-routes.ts   요청 검사, 권한 검사, 응답 모양
<영역>-db.ts       Prisma 쿼리 (표 하나 단위)
<영역>-service.ts  여러 표를 한 트랜잭션으로 묶는 업무 (지금은 banktransfer만)
```

- 공통 도구: `async-handler.ts`(비동기 오류 전달), `http-error.ts`(상태 코드가 있는 오류), `validators.ts`(express-validator 규칙), `user-response.ts`(`omitPassword`, `toOtherUserResponse`), `session-secret.ts`(세션 비밀).
- 돈 도구: `account-money.ts` (계좌 확인, 계좌 간 이동, 사용자 잔액 동기화, 비밀번호 확인). 9절에서 설명한다.
- 검증 순서는 `ensureAuthenticated` → `validateMiddleware(규칙)` → 핸들러이다.
- DB 접근은 `prisma.ts` 하나로 모은다.

권한 규칙은 세 가지 원칙을 따른다.

1. **소유자 조건을 DB 쿼리에 넣는다.** 삭제 함수는 `(userId, id)`를 받고 `where: { id, userId }`로 찾는다. 라우트가 검사를 빼먹어도 남의 것은 바뀌지 않는다. (`removeBankAccountById`)
2. **남의 자원은 "없음"과 같게 답한다.** 존재 여부를 알려 주지 않는다. (404, 또는 빈 `account`)
3. **업무 규칙은 DB 없는 순수 함수로 둔다.** `access.ts`의 `canViewTransaction`처럼 데이터를 읽은 뒤 규칙만 묻는다. 그래서 HTTP 없이 테스트할 수 있다.

돈과 관련된 값은 클라이언트가 정하지 못한다.

- 잔액은 가입과 수정 입력에서 받지 않는다. 이체와 입출금 코드만 바꾼다.
- 다른 회원에게 보내는 사용자 정보(목록, 검색)에서는 잔액을 뺀다. 이체 상대의 계좌 목록에서도 잔액을 뺀다.
- 거래 응답의 계좌 정보(`myAccount`)는 요청한 사람 본인의 계좌 것만 담는다. 상대 계좌와 상대 잔액은 거래 응답에 나가지 않는다 (`attachViewerAccount`).

### 거래 공개 범위

거래의 공개 범위(`privacyLevel`)는 `canViewTransaction`(`access.ts`)이 정한다. 거래 상세, 댓글, 좋아요, 전체 탭, 내 거래 탭이 모두 같은 규칙을 쓴다.

| 공개 범위 | 누가 보는가             |
| --------- | ----------------------- |
| `public`  | 로그인한 모든 회원      |
| 그 밖     | 보낸 사람과 받는 사람만 |

- 설정에서 고를 수 있는 값은 `public`과 `private` 둘뿐이다. DB 열거형에는 옛 값 `contacts`가 남아 있지만, 친구 개념이 없으므로 `private`과 똑같이 취급한다.
- 보낼 때 공개 범위를 안 정하면 보내는 사람의 "기본 공개 범위"(설정 화면)가 쓰인다.
- 볼 수 없는 거래는 "없는 거래"와 똑같이 404로 답한다.
- 거래 목록은 항상 로그인한 회원 기준이다. `receiverId`, `senderId` 쿼리로 다른 회원의 목록을 열 수 없다.

## 7. 오류 응답 규약

| 상황            | 상태                                    | 본문                                           |
| --------------- | --------------------------------------- | ---------------------------------------------- |
| 로그인 안 함    | 401                                     | `{ "error": "Unauthorized" }`                  |
| 입력 검증 실패  | 422                                     | `{ "errors": [...] }` (express-validator 형식) |
| 업무 규칙 위반  | `HttpError`의 상태 (400, 403, 404, 409) | `{ "error": "메시지" }`                        |
| 예상 못 한 오류 | 500                                     | Express 기본 응답 (JSON 아님)                  |

- 422만 키 이름이 `errors`(배열)이고, 나머지는 `error`(문자열)이다. 클라이언트는 둘 다 처리해야 한다.
- 서버의 업무 오류 메시지는 영어이다. 화면에 보여 줄 한국어 문장은 web이 `apiErrors.ts`에서 바꿔 준다. 새 메시지를 만들면 그 표에도 넣는다.
- 돈 규칙 위반의 상태 코드는 다음으로 통일한다: 비밀번호 틀림 403, 남의 계좌 403, 없는 계좌 404, 삭제된 계좌 400, 잔액 부족 400, 한도 초과 400, 같은 계좌끼리 이체 400.

## 8. 데이터 모델

PostgreSQL 표 8개이다. 스키마는 `apps/api/prisma/schema.prisma`에 있다.

- `users`, `bank_accounts`, `transactions`, `likes`, `comments`, `notifications`
- `bank_transfers`, `bank_transfer_logs` (입출금)

### 돈의 기준

- **돈은 은행 계좌(`bank_accounts.balance`)에 들어 있다.** 이것이 유일한 기준이다. 센트 단위 정수(Int)이고, 새 계좌는 0으로 시작한다.
- `users.balance`는 그 사람의 보이는 계좌 잔액의 합계이다. 계산해서 쓰지 말고, 돈을 바꾼 코드가 같은 트랜잭션 안에서 `syncUserBalance`로 맞춘다. 그래서 사이드바 잔액은 이 값을 그대로 쓴다.
- 잔액 상한은 32비트 정수이다 (`MAX_BALANCE_CENTS`). 이체 한 건은 1달러 이상 정수 달러이다.
- `bank_accounts`는 논리 삭제(`visible=false`)를 쓴다. 숨긴 계좌는 목록과 합계에서 빠지고, 이체에 쓸 수 없다. 잔액이 있는 계좌는 숨길 수 없다.
- 라우팅 번호 열은 없다. 계좌는 은행 이름과 계좌번호(9~12자리 숫자)로 정한다.

### 거래 한 줄이 담는 것

`transactions` 한 줄은 이체 한 건이다.

- `senderId`(낸 사람), `receiverId`(받은 사람), `amount`(센트), `privacyLevel`, `status`
- `payerAccountId`, `payeeAccountId`: 어느 계좌에서 어느 계좌로 움직였는지
- `payerBalanceAfter`, `payeeBalanceAfter`: 움직인 직후 두 계좌의 잔액. 거래 목록의 "남은 잔액"은 이 저장값을 쓴다 (나중에 계산하지 않는다).
- 요청 상태 열(`requestStatus`, `requestResolvedAt`)은 없다.

### 외부 입금

`POST /bankTransfers`로 입금하면 계좌 잔액이 늘고, 거래 한 줄도 만들어진다.

- 보낸 사람은 고정값 `senderId = "external-deposit"`(`EXTERNAL_DEPOSIT_SENDER_ID`), 표시 이름은 "외부 입금"(`EXTERNAL_DEPOSIT_NAME`)이다. 둘 다 `@rwa/shared`에 있다.
- 공개 범위는 `private`, 받는 사람은 입금한 본인이다. 그래서 본인만 볼 수 있다.
- 전체 탭에는 입금한 본인에게만 나온다 (`getPublicFeedForApi`가 본인 입금을 더해 준다). 내 거래 탭에도 나온다.
- 출금은 거래 줄을 만들지 않는다. `bank_transfers`에만 남는다.

### 그 밖의 규칙

- 알림 세 종류(받음, 좋아요, 댓글)는 `notifications` 한 표를 같이 쓴다. 이체 알림의 상태 값은 `received` 하나뿐이다.
- 받음 알림의 `userFullName`은 보낸 사람 이름이다.
- `bank_transfer_logs`는 추가만 한다. 수정과 삭제를 하지 않는다. 입출금 한 건은 로그 두 줄(`requested`, `completed`)을 남긴다.
- 입출금 상태 전이는 `requested → completed | failed | canceled` 이다. `completed`에서는 더 못 간다.
- 샘플 데이터는 없다. 앱은 빈 표에서 시작한다.
- 표를 바꿀 때는 마이그레이션 파일을 새로 만든다 (이미 적용한 파일을 고치지 않는다). 테스트 DB는 테스트 시작 때 자동으로 마이그레이션한다.

## 9. 돈을 움직이는 방법 (설계 규칙)

돈이 움직이는 동작은 두 가지이고, 둘 다 **DB 트랜잭션 하나** 안에서 끝낸다. 중간에 하나라도 실패하면 아무것도 저장하지 않는다.

### 9-1. 이체: `POST /transactions` (`createTransaction`)

1. 라우트: 입력 검사 → 비밀번호 재확인(403) → `createTransaction`
2. 금액 검사 (정수 달러, 1 이상, 상한 이하)
3. 보낸 사람과 받는 사람 확인
4. `loadUsableAccount`: 내 계좌는 내 것이어야 하고, 상대 계좌는 상대 것이어야 한다. 없음 404, 남의 것 403, 숨김 400
5. 거래 줄을 `pending`으로 만든다
6. `moveBetweenAccounts`: 두 계좌 행을 `FOR UPDATE`로 잠그고 이동한다
   - 잠그는 순서는 항상 id 순서이다. 서로 반대 방향 이체 두 건이 동시에 와도 서로 기다리다 멈추지 않는다.
   - 보내는 계좌 잔액이 모자라면 400, 받는 계좌가 상한을 넘으면 400, 같은 계좌면 400이다.
   - 두 사용자의 `users.balance`를 맞춘다 (같은 사용자의 계좌끼리면 한 번만).
7. 거래 줄을 `complete`로 바꾸고, 두 계좌의 직후 잔액을 저장한다
8. 받는 사람의 알림 한 줄을 만든다
9. **커밋이 끝난 뒤에** 알림을 실시간으로 내보낸다 (`publishNotifications`)

거절되면 거래 줄도, 알림도 남지 않는다. 같은 사용자의 두 계좌 사이 이체도 허용한다.

### 9-2. 입출금: `POST /bankTransfers` (`moveMoney`)

1. 입력 검사 (정수 달러, 1 이상, 종류는 deposit 또는 withdrawal)
2. 계좌 확인 (없음 404, 남의 계좌 403, 숨긴 계좌 400)
3. 그 계좌 행을 `FOR UPDATE`로 잠근다 (동시 요청이 같은 잔액을 읽는 것을 막는다)
4. 잔액 검사 (출금은 0 아래로 못 간다, 입금은 상한을 못 넘는다)
5. 입금이면 "외부 입금" 거래 줄을 만든다 (8절)
6. `requested` 기록 → 계좌 잔액 변경 → 사용자 잔액 동기화 → `completed` 기록

거절된 요청은 기록도 남기지 않는다.

### 지킬 규칙

- 잔액을 바꾸는 코드는 `account-money.ts`의 함수를 통한다. 라우트나 `*-db.ts`에서 `balance`를 직접 고치지 않는다.
- 잔액을 읽고 고치는 곳은 반드시 행 잠금(`FOR UPDATE`) 안에 둔다. "읽고, 계산하고, 쓰는" 사이에 다른 요청이 끼면 안 된다.
- 여러 행을 잠글 때는 id 순서로 잠근다.
- 알림은 커밋 뒤에 보낸다. 트랜잭션 안에서 보내지 않는다 (되돌려진 알림이 나가면 안 된다).
- 새 돈 동작은 비밀번호 재확인(4절), 소유자 확인, 잠금, 한도 검사, 직후 잔액 저장 순서를 그대로 따른다.

## 10. 실시간 알림 (SSE)

`GET /api/notifications/stream` (`notification-stream.ts`). 클라이언트가 한 번 연결해 두면, 알림이 만들어지고 DB에 커밋된 뒤에 서버가 그 알림을 받을 사람에게만 보낸다. DB를 주기적으로 읽지 않는다.

```
event: notification
data: <GET /api/notifications의 항목 하나와 같은 JSON>
```

- 만드는 곳(이체, 좋아요, 댓글, `POST /notifications/bulk`)이 커밋 뒤에 `publishNotifications`를 부른다. 연결이 하나도 없는 사람의 알림은 아무 비용 없이 건너뛴다.
- 사용자당 연결은 최대 3개이다 (`MAX_STREAMS_PER_USER`). 넘으면 가장 오래된 연결을 닫는다.
- 25초마다 `: ping` 주석 줄을 보낸다. 프록시와 모바일 망이 놀고 있는 연결을 끊지 않게 한다. (시험에서는 환경변수 `NOTIFICATION_STREAM_HEARTBEAT_MS`로 짧게 한다.)
- 첫 줄 `retry: 5000`으로 재연결 간격을 알려 준다.
- 응답 헤더: `text/event-stream`, `no-cache, no-transform`, `X-Accel-Buffering: no` (뒤쪽 프록시가 모아서 보내지 않게 한다).
- 지나간 알림은 다시 보내 주지 않는다. 클라이언트는 연결(재연결)할 때마다 `GET /api/notifications`를 한 번 읽어 따라잡는다.
- 연결 정리: 로그아웃은 그 세션의 연결, 서버 종료는 모든 연결을 닫는다. 연결만 열려 있다고 프로세스가 안 꺼지지는 않는다 (`unref`).
- 연결 목록은 프로세스 메모리에 있다. 서버를 여러 대로 늘리면 다른 서버에 붙은 사람에게는 닿지 않는다 (13절 점검 항목).
- 새 알림 종류를 만들면 `createXxxNotification`의 결과를 모아 두었다가 커밋 뒤에 `publishNotifications`로 넘긴다.

## 11. 검색과 목록 규칙

- 사용자 검색(`userMatchesQuery`, `searchUsers`): 빈 검색어는 모든 회원을 돌려준다. 이름은 성-이름 순서든 이름-성 순서든 공백을 무시하고 맞춘다. 전화번호는 검색어가 전화번호 모양일 때만 비교한다. 별도 검색 라이브러리는 쓰지 않는다.
- 이름은 어디서나 "성 이름" 순서로 보여 준다.
- 입금/출금 방향과 금액 부호는 `getMoneyDirection(tx, userId)` 하나로 정한다. 받는 사람이면 입금, 보낸 사람이면 출금이다. 서버와 web이 같은 함수를 쓴다.
- 목록의 날짜, 금액 범위 필터는 `transactionFilters`(shared)와 `transaction-db.ts`가 같은 규칙으로 처리한다.

## 12. 테스트 구조

| 종류                | 위치                            | 도구       | 비고                                    |
| ------------------- | ------------------------------- | ---------- | --------------------------------------- |
| API 단위, DB 테스트 | `apps/api/src/__tests__`        | Vitest     | 실제 PostgreSQL 사용, 파일 병렬 실행 끔 |
| 공용 유틸 테스트    | `packages/shared/src/__tests__` | Vitest     |                                         |
| 브라우저 e2e        | `e2e/`                          | Playwright | Docker 앱을 대상으로 실행 (스모크 1개)  |

- 테스트 DB(`rwa_test`)는 개발 DB와 분리한다. `db-setup/global.ts`가 마이그레이션을 적용하고, `env.ts`가 Prisma를 테스트 DB로 고정한다. 테스트는 개발 DB에 쓰지 않는다.
- `db-setup/accounts.ts`에 돈 테스트용 도우미가 있다: `fundUser`(계좌 만들고 잔액 채우기), `accountIdOf`, `createTx`.
- 현재 테스트는 DB 계층, 서비스 계층, 권한 규칙(`access.test.ts`) 위주이다. HTTP 라우트를 직접 부르는 테스트는 코드에 없다.
- HTTP로 확인하는 점검(테스트 DB에 임시 서버를 띄워 이체, 비밀번호 재확인, 거절, 공개 범위 등 50개 항목)은 있었지만 저장소에 넣지 않았다 (`LLMS.md` To-do).
- 단위 테스트는 195개이다 (`pnpm test:unit:ci`: shared 31 + api 164).
- 테스트 데이터 초기화는 `/api/testData/reset`으로 할 수 있다.
- 돈 규칙을 바꾸면 최소한 다음을 시험에 넣는다: 잔액 부족, 한도 초과, 남의 계좌, 숨긴 계좌, 같은 계좌, 동시 요청, 실패 시 아무것도 안 남음.

## 13. 설계 점검 항목 (열려 있음)

고칠지 말지는 아직 정하지 않았다.

| #   | 항목                                                                                        | 영역     |
| --- | ------------------------------------------------------------------------------------------- | -------- |
| 1   | CORS 허용 출처가 `localhost`로 고정되어 있다. 외부 공개 시 환경변수로 빼야 한다.            | 배포     |
| 2   | 세션 저장소가 메모리다. 서버를 다시 켜면 모두 로그아웃되고, 서버를 늘릴 수 없다.            | 배포     |
| 3   | 쿠키 설정(secure, sameSite, 만료)을 명시하지 않았다. HTTPS 공개 전에 정해야 한다.           | 보안     |
| 4   | 로그아웃이 `/`로 리다이렉트한다. API라면 JSON 응답이 맞다.                                  | API 규약 |
| 5   | 모바일 앱용 토큰 인증이 없다.                                                               | 인증     |
| 6   | 오류 본문이 422(`errors`)와 나머지(`error`)로 다르다. 예상 못 한 500은 JSON이 아니다.       | API 규약 |
| 7   | 로그인 시도 횟수 제한과 요청 속도 제한이 없다. (비밀번호 재확인 횟수 제한은 두지 않기로 함) | 보안     |
| 8   | `/testData`가 열려 있는 범위(누가, 어느 네트워크에서)를 정해야 한다.                        | 보안     |
| 9   | 다른 회원에게 보이는 사용자 정보의 범위(이메일, 전화번호)를 정해야 한다.                    | 개인정보 |
| 10  | API 설명서(OpenAPI 등)가 없다. 요청과 응답 타입은 `@rwa/shared`에 일부만 있다.              | 문서     |
| 11  | GraphQL은 은행 계좌만 지원한다. 유지할지 정해야 한다.                                       | 범위     |
| 12  | 실시간 알림 연결 목록이 프로세스 메모리다. 서버를 여러 대로 늘리면 공유 방법이 필요하다.    | 배포     |
| 13  | `POST /notifications/bulk`는 테스트와 점검용인데 운영에서도 열려 있다.                      | 보안     |
| 14  | DB 열거형 `PrivacyLevel.contacts`가 남아 있다 (동작은 private과 같다). 정리는 보류.         | 데이터   |

8, 9번은 지금 로컬 개발에서는 문제가 아니고, 외부 공개 전에 정한다. 구체적인 내용은 공개 저장소에 쓰지 않는다.

## 14. 새 기능을 만들 때 점검표

1. 어느 영역인가? 라우트(요청·권한) / db(쿼리) / service(여러 표) 중 알맞은 곳에 둔다.
2. 로그인이 필요한가? `ensureAuthenticated`를 붙인다.
3. 남의 자원을 건드릴 수 있는가? 소유자 조건을 쿼리에 넣고, 없는 것처럼 답한다 (6절).
4. 돈이 움직이는가? 9절의 순서와 규칙을 따르고, 비밀번호 재확인을 서버에 넣는다.
5. 클라이언트와 같이 쓰는 타입과 상수인가? `@rwa/shared`에 둔다.
6. 알림이 생기는가? 커밋 뒤에 `publishNotifications` (10절).
7. 오류는 `HttpError`로 던지고, 상태 코드는 7절을 따른다. web에 한국어 문장을 추가한다.
8. 표가 바뀌는가? 마이그레이션을 새로 만든다. 지우는 경우 딸린 데이터 확인부터 한다.
9. 시험을 쓴다 (12절). `pnpm test:unit:ci`, `pnpm types`, `pnpm lint`가 통과해야 한다.
10. App(모바일)이 쓰는 응답이 바뀌면 `LLMS.md`와 커밋 메시지의 "앱 영향"에 적는다.
