# Test ID 목록

> 이 파일은 `pnpm testid:list`(apps/web/scripts/generateTestIdList.ts, Babel AST)가 자동 생성합니다. 직접 수정하지 마세요.

- 속성: `data-testid` (Playwright `getByTestId()` 기본 속성)
- `${...}`가 들어간 id는 동적 값입니다. 접두사로 찾으세요. 예: `[data-testid^="transaction-item-"]`
- 합계: 파일 47개, test id 236개 (동적 51개)
- id가 없는 상호작용 요소: 0개 (맨 아래 참고)

## 사용 예시

```ts
await page.getByTestId("sidenav-signout").click();
```

## src/components/AccountSelect.tsx

| 줄  | test id               | 종류                | 요소        | 컴포넌트      | 연결 방식  | UI 특징        |
| --- | --------------------- | ------------------- | ----------- | ------------- | ---------- | -------------- |
| 62  | `${testId}-info`      | 동적 (testId)       | `Box`       | AccountRow    | attribute  | -              |
| 66  | `${testId}-bank-name` | 동적 (testId)       | `Box`       | AccountRow    | attribute  | component=span |
| 75  | `${testId}-balance`   | 동적 (testId)       | `Box`       | AccountRow    | attribute  | text="잔액"    |
| 102 | `${testId}-value`     | 동적 (testId)       | `TextField` | AccountSelect | inputProps | onChange       |
| 132 | `${testId}-${a.id}`   | 동적 (testId, a.id) | `MenuItem`  | AccountSelect | attribute  | -              |

## src/components/AlertBar.tsx

| 줄  | test id                                       | 종류                                  | 요소    | 컴포넌트 | 연결 방식 | UI 특징 |
| --- | --------------------------------------------- | ------------------------------------- | ------- | -------- | --------- | ------- |
| 33  | `alert-bar-${snackbarState.context.severity}` | 동적 (snackbarState.context.severity) | `Alert` | AlertBar | attribute | -       |

## src/components/BankAccountForm.tsx

| 줄  | test id                           | 종류 | 요소         | 컴포넌트        | 연결 방식 | UI 특징                                                                                 |
| --- | --------------------------------- | ---- | ------------ | --------------- | --------- | --------------------------------------------------------------------------------------- |
| 77  | `bankaccount-form`                | 정적 | `Form`       | BankAccountForm | attribute | -                                                                                       |
| 78  | `bankaccount-demo-warning`        | 정적 | `Alert`      | BankAccountForm | attribute | text="진짜 자신의 계좌를 만들진 말아주세요! 이건 데모 웹입니다."                        |
| 82  | `bankaccount-error`               | 정적 | `Alert`      | BankAccountForm | attribute | -                                                                                       |
| 86  | `bankaccount-number-guide`        | 정적 | `Typography` | BankAccountForm | attribute | component=p, text="계좌 번호는 9~12자리 숫자입니다. 데모라서 임의의 숫자를 입력해도 됩" |
| 97  | `bankaccount-bankName-input`      | 정적 | `TextField`  | BankAccountForm | attribute | type=text                                                                               |
| 114 | `bankaccount-accountNumber-input` | 정적 | `TextField`  | BankAccountForm | attribute | type=text                                                                               |
| 137 | `bankaccount-submit`              | 정적 | `Button`     | BankAccountForm | attribute | type=submit, text="저장"                                                                |

## src/components/BankAccountItem.tsx

| 줄  | test id                                        | 종류                  | 요소         | 컴포넌트            | 연결 방식 | UI 특징              |
| --- | ---------------------------------------------- | --------------------- | ------------ | ------------------- | --------- | -------------------- |
| 16  | `bankaccount-list-item-${bankAccount.id}`      | 동적 (bankAccount.id) | `ListItem`   | BankAccountListItem | attribute | -                    |
| 22  | `bankaccount-account-number-${bankAccount.id}` | 동적 (bankAccount.id) | `Typography` | BankAccountListItem | attribute | text="계좌 번호:"    |
| 29  | `bankaccount-balance-${bankAccount.id}`        | 동적 (bankAccount.id) | `Typography` | BankAccountListItem | attribute | text="잔액:"         |
| 39  | `bankaccount-delete`                           | 정적                  | `Button`     | BankAccountListItem | attribute | onClick, text="삭제" |

## src/components/BankAccountList.tsx

| 줄  | test id            | 종류 | 요소   | 컴포넌트        | 연결 방식 | UI 특징 |
| --- | ------------------ | ---- | ------ | --------------- | --------- | ------- |
| 17  | `bankaccount-list` | 정적 | `List` | BankAccountList | attribute | -       |

## src/components/CommentForm.tsx

| 줄  | test id                                      | 종류                 | 요소        | 컴포넌트    | 연결 방식  | UI 특징   |
| --- | -------------------------------------------- | -------------------- | ----------- | ----------- | ---------- | --------- |
| 54  | `transaction-comment-input-${transactionId}` | 동적 (transactionId) | `TextField` | CommentForm | inputProps | type=text |

## src/components/CommentList.tsx

| 줄  | test id         | 종류 | 요소   | 컴포넌트     | 연결 방식 | UI 특징 |
| --- | --------------- | ---- | ------ | ------------ | --------- | ------- |
| 13  | `comments-list` | 정적 | `List` | CommentsList | attribute | -       |

## src/components/CommentListItem.tsx

| 줄  | test id                           | 종류              | 요소       | 컴포넌트        | 연결 방식 | UI 특징 |
| --- | --------------------------------- | ----------------- | ---------- | --------------- | --------- | ------- |
| 23  | `comment-list-item-${comment.id}` | 동적 (comment.id) | `ListItem` | CommentListItem | attribute | -       |
| 35  | `comment-author-${comment.id}`    | 동적 (comment.id) | `Box`      | CommentListItem | attribute | -       |
| 62  | `comment-time-${comment.id}`      | 동적 (comment.id) | `span`     | CommentListItem | attribute | -       |

## src/components/DbSnapshot.tsx

| 줄  | test id               | 종류 | 요소         | 컴포넌트   | 연결 방식 | UI 특징                                |
| --- | --------------------- | ---- | ------------ | ---------- | --------- | -------------------------------------- |
| 79  | `demo-db-area`        | 정적 | `Box`        | DbSnapshot | attribute | -                                      |
| 84  | `demo-db-time`        | 정적 | `Typography` | DbSnapshot | attribute | -                                      |
| 87  | `demo-db-refresh`     | 정적 | `Button`     | DbSnapshot | attribute | onClick, text="새로 찍기"              |
| 93  | `demo-db-error`       | 정적 | `Typography` | DbSnapshot | attribute | text="스냅샷을 가져오지 못했습니다:"   |
| 101 | `demo-db-tablelist`   | 정적 | `Box`        | DbSnapshot | attribute | -                                      |
| 108 | `demo-db-table-item`  | 정적 | `Box`        | DbSnapshot | attribute | onClick, type=button, component=button |
| 147 | `demo-db-grid`        | 정적 | `Box`        | DbSnapshot | attribute | -                                      |
| 157 | `demo-db-column`      | 정적 | `Box`        | DbSnapshot | attribute | component=th                           |
| 170 | `demo-db-row`         | 정적 | `tr`         | DbSnapshot | attribute | -                                      |
| 174 | `demo-db-cell`        | 정적 | `Box`        | DbSnapshot | attribute | component=td                           |
| 194 | `demo-db-page-info`   | 정적 | `Typography` | DbSnapshot | attribute | text="· – / 행"                        |
| 198 | `demo-db-page-prev`   | 정적 | `Button`     | DbSnapshot | attribute | onClick, text="이전"                   |
| 206 | `demo-db-page-number` | 정적 | `Typography` | DbSnapshot | attribute | text="/"                               |
| 209 | `demo-db-page-next`   | 정적 | `Button`     | DbSnapshot | attribute | onClick, text="다음"                   |

## src/components/DemoAccordion.tsx

| 줄  | test id                 | 종류 | 요소                | 컴포넌트      | 연결 방식 | UI 특징                                                      |
| --- | ----------------------- | ---- | ------------------- | ------------- | --------- | ------------------------------------------------------------ |
| 177 | `demo-accordion`        | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 193 | `demo-accordion-resize` | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 220 | `demo-accordion-fold`   | 정적 | `Button`            | DemoAccordion | attribute | onClick                                                      |
| 232 | `demo-file-name`        | 정적 | `Typography`        | DemoAccordion | attribute | -                                                            |
| 243 | `demo-cards-toggle`     | 정적 | `Button`            | DemoAccordion | attribute | onClick, text="테스트 별 코드 확인"                          |
| 257 | `demo-view-toggle`      | 정적 | `ToggleButtonGroup` | DemoAccordion | attribute | onChange                                                     |
| 266 | `demo-view-demo`        | 정적 | `ToggleButton`      | DemoAccordion | attribute | text="시연"                                                  |
| 269 | `demo-view-ide`         | 정적 | `ToggleButton`      | DemoAccordion | attribute | text="IDE"                                                   |
| 272 | `demo-view-db`          | 정적 | `ToggleButton`      | DemoAccordion | attribute | text="DB"                                                    |
| 287 | `demo-code-row`         | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 301 | `demo-code-area`        | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 305 | `demo-code`             | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 322 | `demo-code-line`        | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 364 | `demo-message-row`      | 정적 | `Box`               | DemoAccordion | attribute | -                                                            |
| 366 | `demo-error`            | 정적 | `Typography`        | DemoAccordion | attribute | text="실패:"                                                 |
| 371 | `demo-finished`         | 정적 | `Typography`        | DemoAccordion | attribute | text="시연이 끝났습니다. ■를 누르면 처음 상태로 돌아갑니다." |
| 382 | `demo-tab`              | 정적 | `Button`            | DemoAccordion | attribute | onClick                                                      |
| 427 | `demo-next`             | 정적 | `Typography`        | DemoAccordion | attribute | text="다음 테스트:"                                          |

## src/components/DemoApiPanel.tsx

| 줄  | test id                  | 종류 | 요소         | 컴포넌트     | 연결 방식 | UI 특징                                                                      |
| --- | ------------------------ | ---- | ------------ | ------------ | --------- | ---------------------------------------------------------------------------- |
| 58  | `demo-api-panel`         | 정적 | `Box`        | DemoApiPanel | attribute | -                                                                            |
| 74  | `demo-api-toggle`        | 정적 | `IconButton` | DemoApiPanel | attribute | onClick                                                                      |
| 86  | `demo-api-summary`       | 정적 | `Typography` | DemoApiPanel | attribute | -                                                                            |
| 98  | `demo-api-summary`       | 정적 | `Typography` | DemoApiPanel | attribute | text="아직 보낸 요청이 없습니다. 시연이 이 코드를 실행하면 요청이 여기에 남" |
| 105 | `demo-api-body`          | 정적 | `Box`        | DemoApiPanel | attribute | -                                                                            |
| 108 | `demo-api-method`        | 정적 | `Typography` | DemoApiPanel | attribute | -                                                                            |
| 115 | `demo-api-url`           | 정적 | `Typography` | DemoApiPanel | attribute | -                                                                            |
| 123 | `demo-api-send`          | 정적 | `Box`        | DemoApiPanel | attribute | -                                                                            |
| 135 | `demo-api-request-body`  | 정적 | `Box`        | DemoApiPanel | attribute | component=pre                                                                |
| 144 | `demo-api-expect-empty`  | 정적 | `Typography` | DemoApiPanel | attribute | -                                                                            |
| 149 | `demo-api-expect`        | 정적 | `Box`        | DemoApiPanel | attribute | -                                                                            |
| 174 | `demo-api-waiting`       | 정적 | `Typography` | DemoApiPanel | attribute | text="서버의 답을 기다립니다…"                                               |
| 179 | `demo-api-status`        | 정적 | `Typography` | DemoApiPanel | attribute | -                                                                            |
| 182 | `demo-api-time`          | 정적 | `Typography` | DemoApiPanel | attribute | text="ms"                                                                    |
| 194 | `demo-api-response-body` | 정적 | `Box`        | DemoApiPanel | attribute | component=pre                                                                |

## src/components/DemoCards.tsx

| 줄  | test id                  | 종류 | 요소   | 컴포넌트  | 연결 방식 | UI 특징                                |
| --- | ------------------------ | ---- | ------ | --------- | --------- | -------------------------------------- |
| 36  | `demo-cards`             | 정적 | `Box`  | DemoCards | attribute | -                                      |
| 57  | `demo-card`              | 정적 | `Box`  | DemoCards | attribute | onClick, type=button, component=button |
| 106 | `demo-card-dependencies` | 정적 | `Box`  | DemoCards | attribute | -                                      |
| 116 | `demo-card-dependency`   | 정적 | `span` | DemoCards | attribute | -                                      |

## src/components/DemoFooter.tsx

| 줄  | test id         | 종류          | 요소         | 컴포넌트   | 연결 방식 | UI 특징                   |
| --- | --------------- | ------------- | ------------ | ---------- | --------- | ------------------------- |
| 50  | `demo-footer`   | 정적          | `Box`        | DemoFooter | attribute | component=footer          |
| 68  | `demo-prev`     | 정적          | `IconButton` | DemoFooter | attribute | onClick                   |
| 77  | `demo-start`    | 정적          | `Button`     | DemoFooter | attribute | onClick, text="시연 시작" |
| 87  | `demo-toggle`   | 정적          | `IconButton` | DemoFooter | attribute | onClick                   |
| 97  | `demo-stop`     | 정적          | `IconButton` | DemoFooter | attribute | onClick                   |
| 112 | `demo-forward`  | 정적          | `IconButton` | DemoFooter | attribute | onClick                   |
| 125 | `demo-progress` | 정적          | `Box`        | DemoFooter | attribute | -                         |
| 154 | `${testid}`     | 동적 (testid) | `Box`        | TestIdArea | attribute | -                         |

## src/components/DemoIde.tsx

| 줄  | test id                   | 종류 | 요소         | 컴포넌트 | 연결 방식 | UI 특징                                |
| --- | ------------------------- | ---- | ------------ | -------- | --------- | -------------------------------------- |
| 76  | `demo-ide-file-item`      | 정적 | `Box`        | row      | attribute | onClick, type=button, component=button |
| 114 | `demo-ide-running`        | 정적 | `span`       | row      | attribute | text="●"                               |
| 126 | `demo-ide-area`           | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 131 | `demo-ide-summary`        | 정적 | `Typography` | DemoIde  | attribute | text="스냅샷 · 파일 개"                |
| 145 | `demo-ide-filelist`       | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 153 | `demo-ide-folder-group`   | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 154 | `demo-ide-line`           | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 155 | `demo-ide-folder`         | 정적 | `Typography` | DemoIde  | attribute | text="/"                               |
| 165 | `demo-ide-line`           | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 172 | `demo-ide-path`           | 정적 | `Typography` | DemoIde  | attribute | -                                      |
| 189 | `demo-ide-code`           | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 194 | `demo-ide-code-line`      | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 203 | `demo-ide-lines`          | 정적 | `Typography` | DemoIde  | attribute | text="· 줄"                            |
| 208 | `demo-ide-subcodes`       | 정적 | `Box`        | DemoIde  | attribute | -                                      |
| 212 | `demo-ide-subcodes-title` | 정적 | `Typography` | DemoIde  | attribute | -                                      |
| 218 | `demo-ide-subcode`        | 정적 | `Box`        | DemoIde  | attribute | onClick, type=button, component=button |

## src/components/DemoNotice.tsx

| 줄  | test id       | 종류 | 요소       | 컴포넌트   | 연결 방식 | UI 특징 |
| --- | ------------- | ---- | ---------- | ---------- | --------- | ------- |
| 21  | `demo-notice` | 정적 | `Snackbar` | DemoNotice | attribute | -       |

## src/components/DepositDialog.tsx

| 줄  | test id                          | 종류        | 요소        | 컴포넌트      | 연결 방식  | UI 특징                                                                         |
| --- | -------------------------------- | ----------- | ----------- | ------------- | ---------- | ------------------------------------------------------------------------------- |
| 82  | `deposit-dialog`                 | 정적        | `Dialog`    | DepositDialog | attribute  | -                                                                               |
| 86  | `deposit-no-account`             | 정적        | `Alert`     | DepositDialog | attribute  | text="입금하려면 먼저 은행 계좌가 있어야 합니다."                               |
| 91  | `deposit-account-select`         | 정적        | `TextField` | DepositDialog | inputProps | onChange                                                                        |
| 103 | `deposit-account-${a.id}`        | 동적 (a.id) | `MenuItem`  | DepositDialog | attribute  | text="· ·"                                                                      |
| 108 | `deposit-amount-input`           | 정적        | `TextField` | DepositDialog | inputProps | onChange                                                                        |
| 122 | `deposit-error`                  | 정적        | `Alert`     | DepositDialog | attribute  | -                                                                               |
| 128 | `deposit-cancel-button`          | 정적        | `Button`    | DepositDialog | attribute  | onClick, text="취소"                                                            |
| 132 | `deposit-go-bankaccounts-button` | 정적        | `Button`    | DepositDialog | attribute  | onClick, to=/bankaccounts/new, component=${RouterLink}, text="은행 계좌 만들기" |
| 142 | `deposit-submit-button`          | 정적        | `Button`    | DepositDialog | attribute  | onClick, text="입금"                                                            |

## src/components/EmptyList.tsx

| 줄  | test id               | 종류 | 요소   | 컴포넌트  | 연결 방식 | UI 특징 |
| --- | --------------------- | ---- | ------ | --------- | --------- | ------- |
| 28  | `empty-list-header`   | 정적 | `Grid` | EmptyList | attribute | -       |
| 34  | `empty-list-children` | 정적 | `Box`  | EmptyList | attribute | -       |

## src/components/MainLayout.tsx

| 줄  | test id | 종류 | 요소   | 컴포넌트   | 연결 방식 | UI 특징 |
| --- | ------- | ---- | ------ | ---------- | --------- | ------- |
| 110 | `main`  | 정적 | `main` | MainLayout | attribute | -       |

## src/components/NavBar.tsx

| 줄  | test id                       | 종류 | 요소         | 컴포넌트     | 연결 방식 | UI 특징                                    |
| --- | ----------------------------- | ---- | ------------ | ------------ | --------- | ------------------------------------------ |
| 37  | `drawer-icon`                 | 정적 | `SvgIcon`    | TriangleIcon | attribute | -                                          |
| 132 | `sidenav-toggle`              | 정적 | `IconButton` | NavBar       | attribute | onClick                                    |
| 143 | `app-name-logo`               | 정적 | `Typography` | NavBar       | attribute | component=h1                               |
| 150 | `nav-bar-home-link`           | 정적 | `Link`       | NavBar       | attribute | to=/, component=${RouterLink}              |
| 166 | `nav-top-notifications-link`  | 정적 | `IconButton` | NavBar       | attribute | to=/notifications, component=${RouterLink} |
| 173 | `nav-top-notifications-count` | 정적 | `Badge`      | NavBar       | attribute | -                                          |

## src/components/NavDrawer.tsx

| 줄  | test id                  | 종류               | 요소           | 컴포넌트  | 연결 방식 | UI 특징                                                            |
| --- | ------------------------ | ------------------ | -------------- | --------- | --------- | ------------------------------------------------------------------ |
| 236 | `sidenav`                | 정적               | `StyledDrawer` | NavDrawer | attribute | -                                                                  |
| 257 | `sidenav-user-full-name` | 정적               | `Typography`   | NavDrawer | attribute | -                                                                  |
| 267 | `sidenav-username`       | 정적               | `Typography`   | NavDrawer | attribute | text="@"                                                           |
| 274 | `sidenav-balance-box`    | 정적               | `Box`          | NavDrawer | attribute | -                                                                  |
| 278 | `sidenav-user-balance`   | 정적               | `Typography`   | NavDrawer | attribute | -                                                                  |
| 287 | `sidenav-deposit`        | 정적               | `Button`       | NavDrawer | attribute | onClick, text="입금"                                               |
| 300 | `sidenav-transfer`       | 정적               | `Button`       | NavDrawer | attribute | onClick, to=/transaction/new, component=${RouterLink}, text="이체" |
| 321 | `${item.testId}`         | 동적 (item.testId) | `ListItem`     | NavDrawer | attribute | onClick, to=${item.to}, component=${RouterLink}, button            |
| 336 | `sidenav-no-bankaccount` | 정적               | `Typography`   | NavDrawer | attribute | component=div, text="계좌가 없습니다."                             |
| 354 | `sidenav-note`           | 정적               | `ListItem`     | NavDrawer | attribute | onClick, button                                                    |
| 360 | `sidenav-signout`        | 정적               | `ListItem`     | NavDrawer | attribute | onClick, button                                                    |

## src/components/NotificationList.tsx

| 줄  | test id              | 종류 | 요소   | 컴포넌트          | 연결 방식 | UI 특징 |
| --- | -------------------- | ---- | ------ | ----------------- | --------- | ------- |
| 21  | `notifications-list` | 정적 | `List` | NotificationsList | attribute | -       |

## src/components/NotificationListItem.tsx

| 줄  | test id                                     | 종류                   | 요소             | 컴포넌트             | 연결 방식 | UI 특징              |
| --- | ------------------------------------------- | ---------------------- | ---------------- | -------------------- | --------- | -------------------- |
| 86  | `notification-list-item-${notification.id}` | 동적 (notification.id) | `StyledListItem` | NotificationListItem | attribute | -                    |
| 93  | `notification-mark-read-${notification.id}` | 동적 (notification.id) | `IconButton`     | NotificationListItem | attribute | onClick              |
| 104 | `notification-mark-read-${notification.id}` | 동적 (notification.id) | `Button`         | NotificationListItem | attribute | onClick, text="확인" |

## src/components/PasswordConfirmDialog.tsx

| 줄  | test id                    | 종류                | 요소                | 컴포넌트              | 연결 방식  | UI 특징                            |
| --- | -------------------------- | ------------------- | ------------------- | --------------------- | ---------- | ---------------------------------- |
| 83  | `${testIdPrefix}-dialog`   | 동적 (testIdPrefix) | `Dialog`            | PasswordConfirmDialog | attribute  | -                                  |
| 92  | `${testIdPrefix}-summary`  | 동적 (testIdPrefix) | `DialogContentText` | PasswordConfirmDialog | attribute  | component=div                      |
| 97  | `${testIdPrefix}-password` | 동적 (testIdPrefix) | `TextField`         | PasswordConfirmDialog | inputProps | onChange, onKeyDown, type=password |
| 116 | `${testIdPrefix}-error`    | 동적 (testIdPrefix) | `Alert`             | PasswordConfirmDialog | attribute  | -                                  |
| 122 | `${testIdPrefix}-cancel`   | 동적 (testIdPrefix) | `Button`            | PasswordConfirmDialog | attribute  | onClick, text="취소"               |
| 125 | `${testIdPrefix}-confirm`  | 동적 (testIdPrefix) | `Button`            | PasswordConfirmDialog | attribute  | onClick                            |

## src/components/SignInForm.tsx

| 줄  | test id              | 종류 | 요소        | 컴포넌트   | 연결 방식 | UI 특징                    |
| --- | -------------------- | ---- | ----------- | ---------- | --------- | -------------------------- |
| 88  | `signin-error`       | 정적 | `Alert`     | SignInForm | attribute | -                          |
| 112 | `signin-username`    | 정적 | `TextField` | SignInForm | attribute | type=text                  |
| 129 | `signin-password`    | 정적 | `TextField` | SignInForm | attribute | type=password              |
| 148 | `signin-remember-me` | 정적 | `Checkbox`  | SignInForm | attribute | -                          |
| 155 | `signin-submit`      | 정적 | `Button`    | SignInForm | attribute | type=submit, text="로그인" |
| 171 | `signup`             | 정적 | `Link`      | SignInForm | attribute | to=/signup                 |
| 182 | `signin-note-button` | 정적 | `Button`    | SignInForm | attribute | onClick, text="Note"       |

## src/components/SignUpForm.tsx

| 줄  | test id                  | 종류 | 요소         | 컴포넌트   | 연결 방식 | UI 특징                       |
| --- | ------------------------ | ---- | ------------ | ---------- | --------- | ----------------------------- |
| 85  | `signup-title`           | 정적 | `Typography` | SignUpForm | attribute | component=h1, text="회원가입" |
| 89  | `signup-error`           | 정적 | `Alert`      | SignUpForm | attribute | -                             |
| 104 | `signup-last-name`       | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 125 | `signup-first-name`      | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 145 | `signup-username`        | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 162 | `signup-phone-number`    | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 181 | `signup-password`        | 정적 | `TextField`  | SignUpForm | attribute | type=password                 |
| 201 | `signup-confirmPassword` | 정적 | `TextField`  | SignUpForm | attribute | type=password                 |
| 216 | `signup-submit`          | 정적 | `Button`     | SignUpForm | attribute | type=submit, text="회원가입"  |

## src/components/SkeletonList.tsx

| 줄  | test id         | 종류 | 요소   | 컴포넌트     | 연결 방식 | UI 특징 |
| --- | --------------- | ---- | ------ | ------------ | --------- | ------- |
| 21  | `list-skeleton` | 정적 | `Root` | ListSkeleton | attribute | -       |

## src/components/SourceCredit.tsx

| 줄  | test id              | 종류 | 요소         | 컴포넌트     | 연결 방식 | UI 특징                                                                                 |
| --- | -------------------- | ---- | ------------ | ------------ | --------- | --------------------------------------------------------------------------------------- |
| 10  | `source-credit`      | 정적 | `Typography` | SourceCredit | attribute | component=div, text="원본: (MIT License)"                                               |
| 18  | `source-credit-link` | 정적 | `a`          | SourceCredit | attribute | href=https://github.com/cypress-io/cypress-realworld-app, text="Cypress Real World App" |

## src/components/TransactionAmount.tsx

| 줄  | test id                                      | 종류                  | 요소               | 컴포넌트          | 연결 방식 | UI 특징        |
| --- | -------------------------------------------- | --------------------- | ------------------ | ----------------- | --------- | -------------- |
| 67  | `transaction-amount-${transaction.id}`       | 동적 (transaction.id) | `StyledTypography` | TransactionAmount | attribute | component=span |
| 80  | `transaction-balance-${transaction.id}`      | 동적 (transaction.id) | `Typography`       | TransactionAmount | attribute | component=div  |
| 87  | `transaction-balance-bank-${transaction.id}` | 동적 (transaction.id) | `Box`              | TransactionAmount | attribute | component=span |

## src/components/TransactionAmountDirectionFilter.tsx

| 줄  | test id                          | 종류          | 요소             | 컴포넌트                         | 연결 방식  | UI 특징                |
| --- | -------------------------------- | ------------- | ---------------- | -------------------------------- | ---------- | ---------------------- |
| 120 | `${prefix}`                      | 동적 (prefix) | `Box`            | AmountChip                       | attribute  | -                      |
| 125 | `${prefix}-min`                  | 동적 (prefix) | `TextField`      | AmountChip                       | inputProps | onChange               |
| 141 | `${prefix}-max`                  | 동적 (prefix) | `TextField`      | AmountChip                       | inputProps | onChange               |
| 157 | `${prefix}-message`              | 동적 (prefix) | `FormHelperText` | AmountChip                       | attribute  | -                      |
| 173 | `${prefix}-reset-button`         | 동적 (prefix) | `Button`         | AmountChip                       | attribute  | onClick, text="초기화" |
| 176 | `${prefix}-apply-button`         | 동적 (prefix) | `Button`         | AmountChip                       | attribute  | onClick, text="적용"   |
| 191 | `${prefix}-button`               | 동적 (prefix) | `Chip`           | AmountChip                       | attribute  | onClick                |
| 199 | `${prefix}-clear-button`         | 동적 (prefix) | `CancelIcon`     | AmountChip                       | attribute  | -                      |
| 216 | `${prefix}-close-button`         | 동적 (prefix) | `Button`         | AmountChip                       | attribute  | onClick, text="닫기"   |
| 260 | `transaction-list-filter-amount` | 정적          | `Box`            | TransactionAmountDirectionFilter | attribute  | -                      |

## src/components/TransactionCreateStepThree.tsx

| 줄  | test id                                      | 종류 | 요소     | 컴포넌트                   | 연결 방식 | UI 특징                                                      |
| --- | -------------------------------------------- | ---- | -------- | -------------------------- | --------- | ------------------------------------------------------------ |
| 116 | `new-transaction-return-to-transactions`     | 정적 | `Button` | TransactionCreateStepThree | attribute | to=/, component=${RouterLink}, text="거래 목록으로 돌아가기" |
| 127 | `new-transaction-create-another-transaction` | 정적 | `Button` | TransactionCreateStepThree | attribute | onClick, text="다른 이체 진행하기"                           |

## src/components/TransactionCreateStepTwo.tsx

| 줄  | test id                                | 종류 | 요소         | 컴포넌트                 | 연결 방식 | UI 특징                                                |
| --- | -------------------------------------- | ---- | ------------ | ------------------------ | --------- | ------------------------------------------------------ |
| 170 | `transaction-create-form`              | 정적 | `Form`       | TransactionCreateStepTwo | attribute | -                                                      |
| 172 | `transaction-create-send-card`         | 정적 | `Paper`      | TransactionCreateStepTwo | attribute | -                                                      |
| 182 | `transaction-create-amount-input`      | 정적 | `TextField`  | TransactionCreateStepTwo | attribute | type=text                                              |
| 204 | `transaction-create-description-input` | 정적 | `TextField`  | TransactionCreateStepTwo | attribute | type=text                                              |
| 227 | `transaction-create-not-enough`        | 정적 | `Typography` | TransactionCreateStepTwo | attribute | component=p, text="선택한 계좌의 잔액( )이 부족합니다" |
| 238 | `transaction-create-receive-card`      | 정적 | `Paper`      | TransactionCreateStepTwo | attribute | -                                                      |
| 248 | `transaction-create-receiver-name`     | 정적 | `Typography` | TransactionCreateStepTwo | attribute | -                                                      |
| 272 | `transaction-create-submit-payment`    | 정적 | `Button`     | TransactionCreateStepTwo | attribute | type=submit, text="이체"                               |
| 305 | `transaction-confirm-from`             | 정적 | `div`        | TransactionCreateStepTwo | attribute | text="····"                                            |
| 309 | `transaction-confirm-to`               | 정적 | `div`        | TransactionCreateStepTwo | attribute | text="님 ····"                                         |
| 313 | `transaction-confirm-amount`           | 정적 | `Box`        | TransactionCreateStepTwo | attribute | component=b                                            |

## src/components/TransactionDateBoxesFilter.tsx

| 줄  | test id                                     | 종류                      | 요소             | 컴포넌트                   | 연결 방식  | UI 특징                     |
| --- | ------------------------------------------- | ------------------------- | ---------------- | -------------------------- | ---------- | --------------------------- |
| 84  | `${testIdPrefix}-box`                       | 동적 (testIdPrefix)       | `Box`            | DatePartsBox               | attribute  | -                           |
| 117 | `${testIdPrefix}-${part}`                   | 동적 (testIdPrefix, part) | `InputBase`      | DatePartsBox               | inputProps | onChange, onBlur, onKeyDown |
| 218 | `transaction-list-filter-date`              | 정적                      | `Box`            | TransactionDateBoxesFilter | attribute  | -                           |
| 242 | `transaction-list-filter-date-clear-button` | 정적                      | `Button`         | TransactionDateBoxesFilter | attribute  | onClick, text="초기화"      |
| 256 | `transaction-list-filter-date-message`      | 정적                      | `FormHelperText` | TransactionDateBoxesFilter | attribute  | -                           |

## src/components/TransactionDetail.tsx

| 줄  | test id                                     | 종류                  | 요소         | 컴포넌트          | 연결 방식 | UI 특징                        |
| --- | ------------------------------------------- | --------------------- | ------------ | ----------------- | --------- | ------------------------------ |
| 73  | `transaction-detail-header`                 | 정적                  | `Typography` | TransactionDetail | attribute | component=h2, text="거래 상세" |
| 82  | `transaction-item-${transaction.id}`        | 동적 (transaction.id) | `Grid`       | TransactionDetail | attribute | -                              |
| 92  | `transaction-sender-avatar`                 | 정적                  | `Avatar`     | TransactionDetail | attribute | -                              |
| 97  | `transaction-receiver-avatar`               | 정적                  | `Avatar`     | TransactionDetail | attribute | -                              |
| 113 | `transaction-description`                   | 정적                  | `Typography` | TransactionDetail | attribute | -                              |
| 138 | `transaction-like-count-${transaction.id}`  | 동적 (transaction.id) | `Grid`       | TransactionDetail | attribute | -                              |
| 142 | `transaction-like-button-${transaction.id}` | 동적 (transaction.id) | `IconButton` | TransactionDetail | attribute | onClick                        |

## src/components/TransactionInfiniteList.tsx

| 줄  | test id            | 종류 | 요소  | 컴포넌트                | 연결 방식 | UI 특징 |
| --- | ------------------ | ---- | ----- | ----------------------- | --------- | ------- |
| 99  | `transaction-list` | 정적 | `div` | TransactionInfiniteList | attribute | -       |

## src/components/TransactionItem.tsx

| 줄  | test id                              | 종류                  | 요소             | 컴포넌트        | 연결 방식 | UI 특징 |
| --- | ------------------------------------ | --------------------- | ---------------- | --------------- | --------- | ------- |
| 91  | `transaction-item-${transaction.id}` | 동적 (transaction.id) | `StyledListItem` | TransactionItem | attribute | onClick |
| 122 | `transaction-date-${transaction.id}` | 동적 (transaction.id) | `Typography`     | TransactionItem | attribute | -       |
| 149 | `transaction-like-count`             | 정적                  | `Typography`     | TransactionItem | attribute | -       |
| 157 | `transaction-comment-count`          | 정적                  | `Typography`     | TransactionItem | attribute | -       |

## src/components/TransactionList.tsx

| 줄  | test id                                            | 종류 | 요소     | 컴포넌트        | 연결 방식 | UI 특징                                                          |
| --- | -------------------------------------------------- | ---- | -------- | --------------- | --------- | ---------------------------------------------------------------- |
| 74  | `transaction-list-empty-create-transaction-button` | 정적 | `Button` | TransactionList | attribute | to=/transaction/new, component=${RouterLink}, text="거래 만들기" |

## src/components/TransactionListFilters.tsx

| 줄  | test id                    | 종류 | 요소    | 컴포넌트               | 연결 방식 | UI 특징 |
| --- | -------------------------- | ---- | ------- | ---------------------- | --------- | ------- |
| 30  | `transaction-list-filters` | 정적 | `Paper` | TransactionListFilters | attribute | -       |

## src/components/TransactionNavTabs.tsx

| 줄  | test id                | 종류 | 요소   | 컴포넌트           | 연결 방식 | UI 특징                         |
| --- | ---------------------- | ---- | ------ | ------------------ | --------- | ------------------------------- |
| 32  | `nav-transaction-tabs` | 정적 | `Tabs` | TransactionNavTabs | attribute | -                               |
| 41  | `nav-public-tab`       | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/, component=${Link}         |
| 42  | `nav-personal-tab`     | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/personal, component=${Link} |

## src/components/TransactionTitle.tsx

| 줄  | test id                                   | 종류                  | 요소         | 컴포넌트         | 연결 방식 | UI 특징                                    |
| --- | ----------------------------------------- | --------------------- | ------------ | ---------------- | --------- | ------------------------------------------ |
| 42  | `${testId}`                               | 동적 (testId)         | `Typography` | BankName         | attribute | component=span                             |
| 76  | `transaction-sender-${transaction.id}`    | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span                             |
| 86  | `transaction-receiver-${transaction.id}`  | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span                             |
| 96  | `transaction-action-${transaction.id}`    | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span, text="님에게 이체했습니다" |
| 107 | `transaction-bank-line-${transaction.id}` | 동적 (transaction.id) | `div`        | TransactionTitle | attribute | -                                          |
| 115 | `transaction-move-word-${transaction.id}` | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span                             |

## src/components/UpdateNotesDialog.tsx

| 줄  | test id              | 종류 | 요소         | 컴포넌트          | 연결 방식 | UI 특징              |
| --- | -------------------- | ---- | ------------ | ----------------- | --------- | -------------------- |
| 80  | `uiux-notes-intro`   | 정적 | `Typography` | UpdateNotesDialog | attribute | -                    |
| 90  | `uiux-notes-section` | 정적 | `Box`        | UpdateNotesDialog | attribute | -                    |
| 96  | `uiux-notes-line`    | 정적 | `Typography` | UpdateNotesDialog | attribute | component=li         |
| 111 | `uiux-notes-close`   | 정적 | `Button`     | UpdateNotesDialog | attribute | onClick, text="닫기" |

## src/components/UserListItem.tsx

| 줄  | test id                     | 종류           | 요소       | 컴포넌트     | 연결 방식 | UI 특징 |
| --- | --------------------------- | -------------- | ---------- | ------------ | --------- | ------- |
| 14  | `user-list-item-${user.id}` | 동적 (user.id) | `ListItem` | UserListItem | attribute | onClick |

## src/components/UserListSearchForm.tsx

| 줄  | test id                  | 종류 | 요소        | 컴포넌트           | 연결 방식  | UI 특징                     |
| --- | ------------------------ | ---- | ----------- | ------------------ | ---------- | --------------------------- |
| 36  | `user-list-search-input` | 정적 | `TextField` | UserListSearchForm | inputProps | onChange, type=text, name=q |

## src/components/UserSettingsForm.tsx

| 줄  | test id                               | 종류 | 요소               | 컴포넌트         | 연결 방식  | UI 특징                      |
| --- | ------------------------------------- | ---- | ------------------ | ---------------- | ---------- | ---------------------------- |
| 99  | `user-settings-form`                  | 정적 | `Form`             | UserSettingsForm | attribute  | onInput                      |
| 102 | `user-settings-lastName-input`        | 정적 | `TextField`        | UserSettingsForm | inputProps | type=text                    |
| 119 | `user-settings-firstName-input`       | 정적 | `TextField`        | UserSettingsForm | inputProps | type=text                    |
| 136 | `user-settings-email-input`           | 정적 | `TextField`        | UserSettingsForm | inputProps | type=text                    |
| 152 | `user-settings-phoneNumber-input`     | 정적 | `TextField`        | UserSettingsForm | inputProps | type=text                    |
| 170 | `user-settings-privacy`               | 정적 | `RadioGroup`       | UserSettingsForm | attribute  | onChange, name=${field.name} |
| 181 | `user-settings-privacy-public`        | 정적 | `FormControlLabel` | UserSettingsForm | attribute  | -                            |
| 184 | `user-settings-privacy-public-radio`  | 정적 | `Radio`            | UserSettingsForm | attribute  | -                            |
| 189 | `user-settings-privacy-private`       | 정적 | `FormControlLabel` | UserSettingsForm | attribute  | -                            |
| 192 | `user-settings-privacy-private-radio` | 정적 | `Radio`            | UserSettingsForm | attribute  | -                            |
| 205 | `user-settings-message`               | 정적 | `Typography`       | UserSettingsForm | attribute  | role=status, component=div   |
| 228 | `user-settings-submit`                | 정적 | `Button`           | UserSettingsForm | attribute  | type=submit, text="저장"     |

## src/components/UsersList.tsx

| 줄  | test id      | 종류 | 요소   | 컴포넌트  | 연결 방식 | UI 특징 |
| --- | ------------ | ---- | ------ | --------- | --------- | ------- |
| 14  | `users-list` | 정적 | `List` | UsersList | attribute | -       |

## src/containers/BankAccountsContainer.tsx

| 줄  | test id              | 종류 | 요소     | 컴포넌트              | 연결 방식 | UI 특징                                                      |
| --- | -------------------- | ---- | -------- | --------------------- | --------- | ------------------------------------------------------------ |
| 109 | `bankaccount-new`    | 정적 | `Button` | BankAccountsContainer | attribute | to=/bankaccounts/new, component=${RouterLink}, text="만들기" |
| 123 | `bankaccount-limit`  | 정적 | `Alert`  | BankAccountsContainer | attribute | text="은행 계좌는 최대 개까지 만들 수 있습니다."             |
| 128 | `bankaccount-notice` | 정적 | `Alert`  | BankAccountsContainer | attribute | -                                                            |

## src/containers/PrivateRoutesContainer.tsx

| 줄  | test id                  | 종류 | 요소     | 컴포넌트               | 연결 방식 | UI 특징                                           |
| --- | ------------------------ | ---- | -------- | ---------------------- | --------- | ------------------------------------------------- |
| 109 | `amounts-changed-notice` | 정적 | `Alert`  | PrivateRoutesContainer | attribute | text="금액 변동이 생겼어요. 새로고침을 해주세요." |
| 114 | `amounts-changed-reload` | 정적 | `Button` | PrivateRoutesContainer | attribute | onClick, text="새로고침"                          |

## src/containers/TransactionDetailContainer.tsx

| 줄  | test id                      | 종류 | 요소    | 컴포넌트                    | 연결 방식 | UI 특징 |
| --- | ---------------------------- | ---- | ------- | --------------------------- | --------- | ------- |
| 45  | `transaction-detail-failure` | 정적 | `Alert` | TransactionDetailsContainer | attribute | -       |

## id가 없는 상호작용 요소

`pnpm testid:add`로 제안 id를 확인하고, `pnpm testid:add:write`로 반영합니다. 제안이 `-`인 항목은 직접 이름을 정해야 합니다.

없음

## 같은 정적 id가 여러 곳에 있음

조건부 렌더링처럼 의도한 경우일 수 있습니다. 확인만 하세요.

- `demo-api-summary` (2곳)
- `demo-ide-line` (2곳)
