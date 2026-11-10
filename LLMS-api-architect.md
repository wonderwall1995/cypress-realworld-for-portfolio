# LLMS-api-architect

API 서버(`apps/api`)의 현재 설계를 한 번에 정리한 문서다.
코드를 읽고 쓴 것이다. 기준일은 2026-11-10이다.

- 작업 기록은 `monorepo-buildup.md`에 있다. 이 문서는 구조만 다룬다.
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
- API와 web이 같이 쓰는 타입은 전부 `@rwa/shared`에 둔다.
- `.env`는 루트에 한 개만 둔다. API는 `src/load-env.ts`가 읽는다.

## 2. 실행 구조

- 브라우저와 모바일 WebView는 web(7201)에만 접속한다. `/api` 요청은 Vite 프록시가 API(7202)로 넘긴다.
- 그래서 브라우저 입장에서는 같은 출처(same-origin)이다.
- Docker는 컨테이너 두 개를 쓴다. `rwa-app`(web + api)과 `rwa-postgres`이다.
- API 시작 명령은 `ts-node --files src/app.ts` 이다. `--files`가 있어야 `req.user` 타입이 보인다.
- 7202 포트가 이미 쓰이고 있으면, API는 빈 포트로 옮겨서 켜고 경고를 출력한다.

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
- 외부 인증 제공자를 켜면 `Authorization: Bearer` 토큰을 검사한다. `/api/testData/*`는 검사에서 뺀다.
- 모바일 앱용 토큰 인증은 아직 없다. 지금은 쿠키 세션을 WebView에서 쓴다.

## 5. 엔드포인트

모든 경로 앞에 `/api`가 붙는다. "로그인" 열이 `필요`이면 `ensureAuthenticated`가 붙어 있다.
"권한" 열은 로그인한 사람 중 누가 쓸 수 있는지를 말한다 (규칙은 6절).

| 영역         | 메서드와 경로                                                                | 로그인 | 권한                     | 설명                                                                                                |
| ------------ | ---------------------------------------------------------------------------- | ------ | ------------------------ | --------------------------------------------------------------------------------------------------- |
| 인증         | `POST /login`                                                                | -      | -                        | 로그인                                                                                              |
| 인증         | `POST /logout`                                                               | -      | -                        | 로그아웃 (끝에 `/`로 리다이렉트)                                                                    |
| 인증         | `GET /checkAuth`                                                             | -      | -                        | 현재 사용자, 없으면 401                                                                             |
| 사용자       | `POST /users`                                                                | 불필요 | -                        | 회원 가입. 잔액은 항상 0으로 시작한다                                                               |
| 사용자       | `GET /users`, `GET /users/search`                                            | 필요   | 누구나                   | 목록, 검색. 비밀번호와 잔액은 뺀다                                                                  |
| 사용자       | `GET /users/:userId`                                                         | 필요   | 본인만 (아니면 401)      | 내 정보 (잔액 포함)                                                                                 |
| 사용자       | `GET /users/profile/:username`                                               | 불필요 | -                        | 공개 프로필 (이름, 아바타)                                                                          |
| 사용자       | `PATCH /users/:userId`                                                       | 필요   | 본인만 (아니면 403)      | 이름, 이메일, 전화, 아바타, 공개 범위만 수정. 잔액은 못 바꾼다                                      |
| 연락처       | `GET /contacts/:username`                                                    | 필요   | 본인만 (아니면 403)      | 내 연락처 목록                                                                                      |
| 연락처       | `POST /contacts`                                                             | 필요   | 본인 것                  | 연락처 추가                                                                                         |
| 연락처       | `DELETE /contacts/:contactId`                                                | 필요   | 본인 것만 (아니면 404)   | 연락처 삭제                                                                                         |
| 은행 계좌    | `GET /bankAccounts`, `GET /bankAccounts/:id`                                 | 필요   | 본인 것만                | 조회. 남의 계좌는 "없음"과 같게 답한다                                                              |
| 은행 계좌    | `POST /bankAccounts`, `DELETE /bankAccounts/:id`                             | 필요   | 본인 것만 (삭제는 404)   | 생성, 삭제(논리 삭제)                                                                               |
| 거래         | `GET /transactions`                                                          | 필요   | 본인 것                  | 내 거래                                                                                             |
| 거래         | `GET /transactions/contacts`, `/public`                                      | 필요   | -                        | 연락처 거래, 공개 거래                                                                              |
| 거래         | `GET /transactions/:id`                                                      | 필요   | 볼 수 있는 사람만 (404)  | 거래 하나                                                                                           |
| 거래         | `POST /transactions`                                                         | 필요   | 본인이 보내는 사람       | 송금 또는 요청 만들기                                                                               |
| 거래         | `PATCH /transactions/:id`                                                    | 필요   | 요청을 받은 사람만       | 요청 수락 또는 거절. 보낸 사람 403, 거래에 없는 사람 404, 송금(요청 아님) 400, 이미 답한 요청 409   |
| 좋아요, 댓글 | `GET`, `POST /likes/:transactionId`, `/comments/:transactionId`              | 필요   | 볼 수 있는 사람만 (404)  | 거래에 붙는다                                                                                       |
| 알림         | `GET /notifications`, `POST /notifications/bulk`, `PATCH /notifications/:id` | 필요   | 본인 것만                | 읽음 처리 포함                                                                                      |
| 은행 입출금  | `GET /bankTransfers`                                                         | 필요   | 본인 것                  | 내 입출금 목록                                                                                      |
| 은행 입출금  | `POST /bankTransfers`                                                        | 필요   | 본인 계좌만 (아니면 403) | 가상 입금 또는 출금                                                                                 |
| 은행 입출금  | `GET /bankTransfers/:id/logs`                                                | 필요   | 본인 것만 (아니면 404)   | 상태 변화 기록                                                                                      |
| GraphQL      | `/graphql`                                                                   | 간접   | 본인 계좌만              | 은행 계좌 조회, 생성, 삭제만 지원. 라우트에는 로그인 검사가 없고, 처리기가 사용자를 읽다가 실패한다 |
| 테스트       | `POST /testData/reset`, `/seed`                                              | -      | -                        | 모든 테이블 비우기 (둘이 같은 동작)                                                                 |
| 테스트       | `GET /testData/:entity`                                                      | -      | -                        | 테이블 전체 조회                                                                                    |

`/testData`는 `NODE_ENV`가 `test` 또는 `development`일 때만 연결된다.

## 6. 코드 계층과 권한 규칙

한 영역은 보통 파일 세 개로 나뉜다.

```
<영역>-routes.ts   요청 검사, 권한 검사, 응답 모양
<영역>-db.ts       Prisma 쿼리 (표 하나 단위)
<영역>-service.ts  여러 표를 한 트랜잭션으로 묶는 업무 (지금은 banktransfer만)
```

- 공통 도구: `async-handler.ts`(비동기 오류 전달), `http-error.ts`(상태 코드가 있는 오류), `validators.ts`(express-validator 규칙), `user-response.ts`(`omitPassword`, `toOtherUserResponse`), `session-secret.ts`(세션 비밀).
- 검증 순서는 `ensureAuthenticated` → `validateMiddleware(규칙)` → 핸들러이다.
- DB 접근은 `prisma.ts` 하나로 모은다.

권한 규칙은 세 가지 원칙을 따른다.

1. **소유자 조건을 DB 쿼리에 넣는다.** 삭제 함수는 `(userId, id)`를 받고 `where: { id, userId }`로 지운다. 라우트가 검사를 빼먹어도 남의 것은 지워지지 않는다. (`removeBankAccountById`, `removeContactById`)
2. **남의 자원은 "없음"과 같게 답한다.** 존재 여부를 알려 주지 않는다. (404, 또는 빈 `account`)
3. **업무 규칙은 DB 없는 순수 함수로 둔다.** `access.ts`의 `assertCanAnswerRequest`처럼 데이터를 읽은 뒤 규칙만 묻는다. 그래서 HTTP 없이 테스트할 수 있다.

돈과 관련된 값은 클라이언트가 정하지 못한다.

- 잔액은 가입과 수정 입력에서 받지 않는다. 결제와 입출금 코드만 바꾼다.
- 다른 회원에게 보내는 사용자 정보(목록, 검색)에서는 잔액을 뺀다.
- 요청(request)에 답하는 사람은 돈을 내는 쪽(받는 사람)뿐이다.

거래의 공개 범위(`privacyLevel`)는 `canViewTransaction`(`access.ts`)이 정한다. 거래 상세, 댓글, 좋아요, 친구 탭, 전체 탭이 모두 같은 규칙을 쓴다.

| 공개 범위  | 누가 보는가                                                 |
| ---------- | ----------------------------------------------------------- |
| `public`   | 로그인한 모든 회원                                          |
| `contacts` | 보낸 사람, 받는 사람, 그리고 둘 중 한 명을 연락처에 둔 회원 |
| `private`  | 보낸 사람과 받는 사람만                                     |

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

## 8. 데이터 모델

PostgreSQL 표 9개이다. 스키마는 `apps/api/prisma/schema.prisma`에 있다.

- `users`, `contacts`, `bank_accounts`, `transactions`, `likes`, `comments`, `notifications`
- `bank_transfers`, `bank_transfer_logs` (입출금)

규칙은 다음과 같다.

- 돈은 센트 단위 정수(Int)로 저장한다. 잔액 상한은 32비트 정수이다.
- `bank_accounts`는 논리 삭제(`isDeleted`)를 쓴다.
- 알림 세 종류(결제, 좋아요, 댓글)는 `notifications` 한 표를 같이 쓴다.
- `bank_transfer_logs`는 추가만 한다. 수정과 삭제를 하지 않는다. 입출금 한 건은 로그 두 줄(`requested`, `completed`)을 남긴다.
- 입출금 상태 전이는 `requested → completed | failed | canceled` 이다. `completed`에서는 더 못 간다.
- 샘플 데이터는 없다. 앱은 빈 표에서 시작한다. (개발 DB도 2026-11-10에 모두 비웠다.)

### 입출금 처리 순서

`POST /bankTransfers`는 DB 트랜잭션 하나 안에서 끝난다.

1. 입력 검사 (정수 달러, 1 이상, 종류는 deposit 또는 withdrawal)
2. 계좌 확인 (없음 404, 남의 계좌 403, 삭제된 계좌 400)
3. 사용자 행을 `FOR UPDATE`로 잠근다 (동시 요청이 같은 잔액을 읽는 것을 막는다)
4. 잔액 검사 (출금은 0 아래로 못 간다, 입금은 상한을 못 넘는다)
5. `requested` 기록 → 잔액 변경 → `completed` 기록

중간에 하나라도 실패하면 아무것도 저장하지 않는다. 거절된 요청은 기록도 남기지 않는다.

## 9. 테스트 구조

| 종류                | 위치                            | 도구       | 비고                                    |
| ------------------- | ------------------------------- | ---------- | --------------------------------------- |
| API 단위, DB 테스트 | `apps/api/src/__tests__`        | Vitest     | 실제 PostgreSQL 사용, 파일 병렬 실행 끔 |
| 공용 유틸 테스트    | `packages/shared/src/__tests__` | Vitest     |                                         |
| 브라우저 e2e        | `e2e/`                          | Playwright | Docker 앱을 대상으로 실행               |

- 테스트 DB는 개발 DB와 분리한다. `db-setup/global.ts`가 마이그레이션을 적용하고, `env.ts`가 Prisma를 테스트 DB로 고정한다.
- 현재 테스트는 DB 계층, 서비스 계층, 권한 규칙(`access.test.ts`) 위주이다. HTTP 라우트를 직접 부르는 테스트는 코드에 없다.
- 권한 규칙을 HTTP로 확인하는 점검은 있었다 (테스트 DB에 임시 서버를 띄워 권한 30개, 공개 범위 22개 항목을 확인). 이 점검은 저장소에 넣지 않았다.
- 단위 테스트는 122개이다 (`pnpm test:unit:ci`: shared 6 + api 116).
- 테스트 데이터 초기화는 `/api/testData/reset`으로 할 수 있다.

## 10. 설계 점검 항목 (열려 있음)

고칠지 말지는 아직 정하지 않았다.

| #   | 항목                                                                                  | 영역     |
| --- | ------------------------------------------------------------------------------------- | -------- |
| 1   | CORS 허용 출처가 `localhost`로 고정되어 있다. 외부 공개 시 환경변수로 빼야 한다.      | 배포     |
| 2   | 세션 저장소가 메모리다. 서버를 다시 켜면 모두 로그아웃되고, 서버를 늘릴 수 없다.      | 배포     |
| 3   | 쿠키 설정(secure, sameSite, 만료)을 명시하지 않았다. HTTPS 공개 전에 정해야 한다.     | 보안     |
| 4   | 로그아웃이 `/`로 리다이렉트한다. API라면 JSON 응답이 맞다.                            | API 규약 |
| 5   | 모바일 앱용 토큰 인증이 없다.                                                         | 인증     |
| 6   | 오류 본문이 422(`errors`)와 나머지(`error`)로 다르다. 예상 못 한 500은 JSON이 아니다. | API 규약 |
| 7   | 로그인 시도 횟수 제한과 요청 속도 제한이 없다.                                        | 보안     |
| 8   | `/testData`가 열려 있는 범위(누가, 어느 네트워크에서)를 정해야 한다.                  | 보안     |
| 9   | 다른 회원에게 보이는 사용자 정보의 범위(이메일, 전화번호)를 정해야 한다.              | 개인정보 |
| 11  | API 설명서(OpenAPI 등)가 없다. 요청과 응답 타입은 `@rwa/shared`에 일부만 있다.        | 문서     |
| 12  | GraphQL은 은행 계좌만 지원한다. 유지할지 정해야 한다.                                 | 범위     |

8, 9번은 지금 로컬 개발에서는 문제가 아니고, 외부 공개 전에 정한다. 구체적인 내용은 공개 저장소에 쓰지 않는다.

### 해결된 항목 (2026-11-10)

- 세션 비밀을 코드에서 없애고 `SESSION_SECRET`으로 옮겼다.
- 사용자 정보 수정에 본인 확인을 넣고, 잔액은 가입과 수정 입력에서 받지 않게 했다.
- 연락처 조회를 로그인과 본인으로 제한했다. 연락처 삭제는 본인 것만 된다.
- 은행 계좌 조회와 삭제를 본인 것만 되게 했다 (GraphQL 포함).
- 요청 거래에 답하는 사람을 돈을 내는 쪽으로 제한했다.
- 사용자 목록과 검색에서 다른 회원의 잔액을 뺐다.
- 거래 공개 범위를 서버가 지킨다. 친구 탭과 전체 탭에 남의 비공개 거래가 보이던 문제, 거래 상세와 댓글과 좋아요를 id로 열던 문제, 목록 쿼리로 다른 회원의 거래를 열던 문제를 고쳤다.
- 개발 DB의 점검용 샘플 데이터를 지웠고, 이어서 `admin` 계정과 그 데이터도 지웠다. 개발 DB는 비어 있다.
