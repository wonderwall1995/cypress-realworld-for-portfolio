# Test ID 목록

> 이 파일은 `pnpm testid:list`(apps/web/scripts/generateTestIdList.ts, Babel AST)가 자동 생성합니다. 직접 수정하지 마세요.

- 속성: `data-testid` (Playwright `getByTestId()` 기본 속성)
- `${...}`가 들어간 id는 동적 값입니다. 접두사로 찾으세요. 예: `[data-testid^="transaction-item-"]`
- 합계: 파일 36개, test id 123개 (동적 33개)
- id가 없는 상호작용 요소: 0개 (맨 아래 참고)

## 사용 예시

```ts
await page.getByTestId("sidenav-signout").click();
```

## src/components/AlertBar.tsx

| 줄  | test id                                       | 종류                                  | 요소    | 컴포넌트 | 연결 방식 | UI 특징 |
| --- | --------------------------------------------- | ------------------------------------- | ------- | -------- | --------- | ------- |
| 33  | `alert-bar-${snackbarState.context.severity}` | 동적 (snackbarState.context.severity) | `Alert` | AlertBar | attribute | -       |

## src/components/BankAccountForm.tsx

| 줄  | test id                           | 종류 | 요소         | 컴포넌트        | 연결 방식 | UI 특징                                                                                 |
| --- | --------------------------------- | ---- | ------------ | --------------- | --------- | --------------------------------------------------------------------------------------- |
| 76  | `bankaccount-form`                | 정적 | `Form`       | BankAccountForm | attribute | -                                                                                       |
| 77  | `bankaccount-demo-warning`        | 정적 | `Alert`      | BankAccountForm | attribute | text="진짜 자신의 계좌를 만들진 말아주세요! 이건 데모 웹입니다."                        |
| 80  | `bankaccount-number-guide`        | 정적 | `Typography` | BankAccountForm | attribute | component=p, text="계좌 번호는 9~12자리 숫자입니다. 데모라서 임의의 숫자를 입력해도 됩" |
| 91  | `bankaccount-bankName-input`      | 정적 | `TextField`  | BankAccountForm | attribute | type=text                                                                               |
| 108 | `bankaccount-accountNumber-input` | 정적 | `TextField`  | BankAccountForm | attribute | type=text                                                                               |
| 131 | `bankaccount-submit`              | 정적 | `Button`     | BankAccountForm | attribute | type=submit, text="저장"                                                                |

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
| 12  | `comment-list-item-${comment.id}` | 동적 (comment.id) | `ListItem` | CommentListItem | attribute | -       |

## src/components/DepositDialog.tsx

| 줄  | test id                          | 종류        | 요소        | 컴포넌트      | 연결 방식  | UI 특징                                                                         |
| --- | -------------------------------- | ----------- | ----------- | ------------- | ---------- | ------------------------------------------------------------------------------- |
| 81  | `deposit-dialog`                 | 정적        | `Dialog`    | DepositDialog | attribute  | -                                                                               |
| 85  | `deposit-no-account`             | 정적        | `Alert`     | DepositDialog | attribute  | text="입금하려면 먼저 은행 계좌가 있어야 합니다."                               |
| 90  | `deposit-account-select`         | 정적        | `TextField` | DepositDialog | inputProps | onChange                                                                        |
| 102 | `deposit-account-${a.id}`        | 동적 (a.id) | `MenuItem`  | DepositDialog | attribute  | text="· ·"                                                                      |
| 107 | `deposit-amount-input`           | 정적        | `TextField` | DepositDialog | inputProps | onChange                                                                        |
| 121 | `deposit-error`                  | 정적        | `Alert`     | DepositDialog | attribute  | -                                                                               |
| 127 | `deposit-cancel-button`          | 정적        | `Button`    | DepositDialog | attribute  | onClick, text="취소"                                                            |
| 131 | `deposit-go-bankaccounts-button` | 정적        | `Button`    | DepositDialog | attribute  | onClick, to=/bankaccounts/new, component=${RouterLink}, text="은행 계좌 만들기" |
| 141 | `deposit-submit-button`          | 정적        | `Button`    | DepositDialog | attribute  | onClick, text="입금"                                                            |

## src/components/EmptyList.tsx

| 줄  | test id               | 종류 | 요소   | 컴포넌트  | 연결 방식 | UI 특징 |
| --- | --------------------- | ---- | ------ | --------- | --------- | ------- |
| 28  | `empty-list-header`   | 정적 | `Grid` | EmptyList | attribute | -       |
| 34  | `empty-list-children` | 정적 | `Box`  | EmptyList | attribute | -       |

## src/components/MainLayout.tsx

| 줄  | test id | 종류 | 요소   | 컴포넌트   | 연결 방식 | UI 특징 |
| --- | ------- | ---- | ------ | ---------- | --------- | ------- |
| 109 | `main`  | 정적 | `main` | MainLayout | attribute | -       |

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
| 190 | `sidenav`                | 정적               | `StyledDrawer` | NavDrawer | attribute | -                                                                  |
| 211 | `sidenav-user-full-name` | 정적               | `Typography`   | NavDrawer | attribute | -                                                                  |
| 218 | `sidenav-username`       | 정적               | `Typography`   | NavDrawer | attribute | text="@"                                                           |
| 225 | `sidenav-balance-box`    | 정적               | `Box`          | NavDrawer | attribute | -                                                                  |
| 229 | `sidenav-user-balance`   | 정적               | `Typography`   | NavDrawer | attribute | -                                                                  |
| 238 | `sidenav-deposit`        | 정적               | `Button`       | NavDrawer | attribute | onClick, text="입금"                                               |
| 251 | `sidenav-transfer`       | 정적               | `Button`       | NavDrawer | attribute | onClick, to=/transaction/new, component=${RouterLink}, text="이체" |
| 269 | `${item.testId}`         | 동적 (item.testId) | `ListItem`     | NavDrawer | attribute | onClick, to=${item.to}, component=${RouterLink}, button            |
| 288 | `sidenav-signout`        | 정적               | `ListItem`     | NavDrawer | attribute | onClick, button                                                    |

## src/components/NotificationList.tsx

| 줄  | test id              | 종류 | 요소   | 컴포넌트          | 연결 방식 | UI 특징 |
| --- | -------------------- | ---- | ------ | ----------------- | --------- | ------- |
| 21  | `notifications-list` | 정적 | `List` | NotificationsList | attribute | -       |

## src/components/NotificationListItem.tsx

| 줄  | test id                                     | 종류                   | 요소             | 컴포넌트             | 연결 방식 | UI 특징              |
| --- | ------------------------------------------- | ---------------------- | ---------------- | -------------------- | --------- | -------------------- |
| 93  | `notification-list-item-${notification.id}` | 동적 (notification.id) | `StyledListItem` | NotificationListItem | attribute | -                    |
| 97  | `notification-mark-read-${notification.id}` | 동적 (notification.id) | `IconButton`     | NotificationListItem | attribute | onClick              |
| 108 | `notification-mark-read-${notification.id}` | 동적 (notification.id) | `Button`         | NotificationListItem | attribute | onClick, text="확인" |

## src/components/SignInForm.tsx

| 줄  | test id              | 종류 | 요소        | 컴포넌트   | 연결 방식 | UI 특징                    |
| --- | -------------------- | ---- | ----------- | ---------- | --------- | -------------------------- |
| 86  | `signin-error`       | 정적 | `Alert`     | SignInForm | attribute | -                          |
| 110 | `signin-username`    | 정적 | `TextField` | SignInForm | attribute | type=text                  |
| 127 | `signin-password`    | 정적 | `TextField` | SignInForm | attribute | type=password              |
| 146 | `signin-remember-me` | 정적 | `Checkbox`  | SignInForm | attribute | -                          |
| 153 | `signin-submit`      | 정적 | `Button`    | SignInForm | attribute | type=submit, text="로그인" |
| 169 | `signup`             | 정적 | `Link`      | SignInForm | attribute | to=/signup                 |

## src/components/SignUpForm.tsx

| 줄  | test id                  | 종류 | 요소         | 컴포넌트   | 연결 방식 | UI 특징                       |
| --- | ------------------------ | ---- | ------------ | ---------- | --------- | ----------------------------- |
| 84  | `signup-title`           | 정적 | `Typography` | SignUpForm | attribute | component=h1, text="회원가입" |
| 100 | `signup-last-name`       | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 118 | `signup-first-name`      | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 135 | `signup-username`        | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 152 | `signup-phone-number`    | 정적 | `TextField`  | SignUpForm | attribute | type=text                     |
| 171 | `signup-password`        | 정적 | `TextField`  | SignUpForm | attribute | type=password                 |
| 188 | `signup-confirmPassword` | 정적 | `TextField`  | SignUpForm | attribute | type=password                 |
| 203 | `signup-submit`          | 정적 | `Button`     | SignUpForm | attribute | type=submit, text="회원가입"  |

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

| 줄  | test id                                | 종류                  | 요소               | 컴포넌트          | 연결 방식 | UI 특징        |
| --- | -------------------------------------- | --------------------- | ------------------ | ----------------- | --------- | -------------- |
| 66  | `transaction-amount-${transaction.id}` | 동적 (transaction.id) | `StyledTypography` | TransactionAmount | attribute | component=span |

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
| 117 | `new-transaction-return-to-transactions`     | 정적 | `Button` | TransactionCreateStepThree | attribute | to=/, component=${RouterLink}, text="거래 목록으로 돌아가기" |
| 128 | `new-transaction-create-another-transaction` | 정적 | `Button` | TransactionCreateStepThree | attribute | onClick, text="다른 거래 만들기"                             |

## src/components/TransactionCreateStepTwo.tsx

| 줄  | test id                                | 종류 | 요소        | 컴포넌트                 | 연결 방식 | UI 특징                           |
| --- | -------------------------------------- | ---- | ----------- | ------------------------ | --------- | --------------------------------- |
| 136 | `transaction-create-form`              | 정적 | `Form`      | TransactionCreateStepTwo | attribute | -                                 |
| 139 | `transaction-create-amount-input`      | 정적 | `TextField` | TransactionCreateStepTwo | attribute | type=text                         |
| 161 | `transaction-create-description-input` | 정적 | `TextField` | TransactionCreateStepTwo | attribute | type=text                         |
| 184 | `transaction-create-submit-request`    | 정적 | `Button`    | TransactionCreateStepTwo | attribute | onClick, type=submit, text="요청" |
| 198 | `transaction-create-submit-payment`    | 정적 | `Button`    | TransactionCreateStepTwo | attribute | onClick, type=submit, text="결제" |

## src/components/TransactionDateBoxesFilter.tsx

| 줄  | test id                                     | 종류                      | 요소             | 컴포넌트                   | 연결 방식  | UI 특징                     |
| --- | ------------------------------------------- | ------------------------- | ---------------- | -------------------------- | ---------- | --------------------------- |
| 84  | `${testIdPrefix}-box`                       | 동적 (testIdPrefix)       | `Box`            | DatePartsBox               | attribute  | -                           |
| 117 | `${testIdPrefix}-${part}`                   | 동적 (testIdPrefix, part) | `InputBase`      | DatePartsBox               | inputProps | onChange, onBlur, onKeyDown |
| 215 | `transaction-list-filter-date`              | 정적                      | `Box`            | TransactionDateBoxesFilter | attribute  | -                           |
| 239 | `transaction-list-filter-date-clear-button` | 정적                      | `Button`         | TransactionDateBoxesFilter | attribute  | onClick, text="초기화"      |
| 253 | `transaction-list-filter-date-message`      | 정적                      | `FormHelperText` | TransactionDateBoxesFilter | attribute  | -                           |

## src/components/TransactionDetail.tsx

| 줄  | test id                                        | 종류                  | 요소         | 컴포넌트          | 연결 방식 | UI 특징                        |
| --- | ---------------------------------------------- | --------------------- | ------------ | ----------------- | --------- | ------------------------------ |
| 111 | `transaction-detail-header`                    | 정적                  | `Typography` | TransactionDetail | attribute | component=h2, text="거래 상세" |
| 120 | `transaction-item-${transaction.id}`           | 동적 (transaction.id) | `Grid`       | TransactionDetail | attribute | -                              |
| 130 | `transaction-sender-avatar`                    | 정적                  | `Avatar`     | TransactionDetail | attribute | -                              |
| 135 | `transaction-receiver-avatar`                  | 정적                  | `Avatar`     | TransactionDetail | attribute | -                              |
| 150 | `transaction-description`                      | 정적                  | `Typography` | TransactionDetail | attribute | -                              |
| 174 | `transaction-like-count-${transaction.id}`     | 동적 (transaction.id) | `Grid`       | TransactionDetail | attribute | -                              |
| 178 | `transaction-like-button-${transaction.id}`    | 동적 (transaction.id) | `IconButton` | TransactionDetail | attribute | onClick                        |
| 192 | `transaction-accept-request-${transaction.id}` | 동적 (transaction.id) | `Button`     | TransactionDetail | attribute | onClick, text="요청 수락"      |
| 206 | `transaction-reject-request-${transaction.id}` | 동적 (transaction.id) | `Button`     | TransactionDetail | attribute | onClick, text="요청 거절"      |

## src/components/TransactionInfiniteList.tsx

| 줄  | test id            | 종류 | 요소  | 컴포넌트                | 연결 방식 | UI 특징 |
| --- | ------------------ | ---- | ----- | ----------------------- | --------- | ------- |
| 77  | `transaction-list` | 정적 | `div` | TransactionInfiniteList | attribute | -       |

## src/components/TransactionItem.tsx

| 줄  | test id                              | 종류                  | 요소             | 컴포넌트        | 연결 방식 | UI 특징 |
| --- | ------------------------------------ | --------------------- | ---------------- | --------------- | --------- | ------- |
| 83  | `transaction-item-${transaction.id}` | 동적 (transaction.id) | `StyledListItem` | TransactionItem | attribute | onClick |
| 130 | `transaction-like-count`             | 정적                  | `Typography`     | TransactionItem | attribute | -       |
| 138 | `transaction-comment-count`          | 정적                  | `Typography`     | TransactionItem | attribute | -       |

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
| 37  | `nav-transaction-tabs` | 정적 | `Tabs` | TransactionNavTabs | attribute | onChange                        |
| 47  | `nav-public-tab`       | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/, component=${Link}         |
| 48  | `nav-contacts-tab`     | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/contacts, component=${Link} |
| 49  | `nav-personal-tab`     | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/personal, component=${Link} |

## src/components/TransactionTitle.tsx

| 줄  | test id                                  | 종류                  | 요소         | 컴포넌트         | 연결 방식 | UI 특징        |
| --- | ---------------------------------------- | --------------------- | ------------ | ---------------- | --------- | -------------- |
| 44  | `transaction-sender-${transaction.id}`   | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span |
| 53  | `transaction-receiver-${transaction.id}` | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span |
| 61  | `transaction-action-${transaction.id}`   | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span |

## src/components/UserListItem.tsx

| 줄  | test id                     | 종류           | 요소       | 컴포넌트     | 연결 방식 | UI 특징 |
| --- | --------------------------- | -------------- | ---------- | ------------ | --------- | ------- |
| 14  | `user-list-item-${user.id}` | 동적 (user.id) | `ListItem` | UserListItem | attribute | onClick |

## src/components/UserListSearchForm.tsx

| 줄  | test id                  | 종류 | 요소        | 컴포넌트           | 연결 방식  | UI 특징                     |
| --- | ------------------------ | ---- | ----------- | ------------------ | ---------- | --------------------------- |
| 36  | `user-list-search-input` | 정적 | `TextField` | UserListSearchForm | inputProps | onChange, type=text, name=q |

## src/components/UserSettingsForm.tsx

| 줄  | test id                           | 종류 | 요소        | 컴포넌트         | 연결 방식  | UI 특징                  |
| --- | --------------------------------- | ---- | ----------- | ---------------- | ---------- | ------------------------ |
| 67  | `user-settings-form`              | 정적 | `Form`      | UserSettingsForm | attribute  | -                        |
| 70  | `user-settings-lastName-input`    | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 87  | `user-settings-firstName-input`   | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 104 | `user-settings-email-input`       | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 121 | `user-settings-phoneNumber-input` | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 144 | `user-settings-submit`            | 정적 | `Button`    | UserSettingsForm | attribute  | type=submit, text="저장" |

## src/components/UsersList.tsx

| 줄  | test id      | 종류 | 요소   | 컴포넌트  | 연결 방식 | UI 특징 |
| --- | ------------ | ---- | ------ | --------- | --------- | ------- |
| 14  | `users-list` | 정적 | `List` | UsersList | attribute | -       |

## src/containers/BankAccountsContainer.tsx

| 줄  | test id           | 종류 | 요소     | 컴포넌트              | 연결 방식 | UI 특징                                                      |
| --- | ----------------- | ---- | -------- | --------------------- | --------- | ------------------------------------------------------------ |
| 89  | `bankaccount-new` | 정적 | `Button` | BankAccountsContainer | attribute | to=/bankaccounts/new, component=${RouterLink}, text="만들기" |

## src/containers/UserOnboardingContainer.tsx

| 줄  | test id                          | 종류 | 요소            | 컴포넌트                | 연결 방식 | UI 특징                  |
| --- | -------------------------------- | ---- | --------------- | ----------------------- | --------- | ------------------------ |
| 73  | `user-onboarding-dialog`         | 정적 | `Dialog`        | UserOnboardingContainer | attribute | -                        |
| 74  | `user-onboarding-dialog-title`   | 정적 | `DialogTitle`   | UserOnboardingContainer | attribute | -                        |
| 79  | `user-onboarding-dialog-content` | 정적 | `DialogContent` | UserOnboardingContainer | attribute | -                        |
| 117 | `user-onboarding-logout`         | 정적 | `Button`        | UserOnboardingContainer | attribute | onClick, text="로그아웃" |
| 128 | `user-onboarding-next`           | 정적 | `Button`        | UserOnboardingContainer | attribute | onClick                  |

## id가 없는 상호작용 요소

`pnpm testid:add`로 제안 id를 확인하고, `pnpm testid:add:write`로 반영합니다. 제안이 `-`인 항목은 직접 이름을 정해야 합니다.

없음
