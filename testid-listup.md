# Test ID 목록

> 이 파일은 `pnpm testid:list`(scripts/generateTestIdList.ts, Babel AST)가 자동 생성합니다. 직접 수정하지 마세요.

- 속성: `data-testid` (Playwright `getByTestId()` 기본 속성)
- `${...}`가 들어간 id는 동적 값입니다. 접두사로 찾으세요. 예: `[data-testid^="transaction-item-"]`
- 합계: 파일 33개, test id 107개 (동적 19개)
- id가 없는 상호작용 요소: 3개 (맨 아래 참고)

## 사용 예시

```ts
await page.getByTestId("sidenav-signout").click();
```

## src/components/AlertBar.tsx

| 줄  | test id                                       | 종류                                  | 요소    | 컴포넌트 | 연결 방식 | UI 특징 |
| --- | --------------------------------------------- | ------------------------------------- | ------- | -------- | --------- | ------- |
| 33  | `alert-bar-${snackbarState.context.severity}` | 동적 (snackbarState.context.severity) | `Alert` | AlertBar | attribute | -       |

## src/components/BankAccountForm.tsx

| 줄  | test id                           | 종류 | 요소        | 컴포넌트        | 연결 방식 | UI 특징                  |
| --- | --------------------------------- | ---- | ----------- | --------------- | --------- | ------------------------ |
| 81  | `bankaccount-form`                | 정적 | `Form`      | BankAccountForm | attribute | -                        |
| 84  | `bankaccount-bankName-input`      | 정적 | `TextField` | BankAccountForm | attribute | type=text                |
| 101 | `bankaccount-routingNumber-input` | 정적 | `TextField` | BankAccountForm | attribute | type=text                |
| 118 | `bankaccount-accountNumber-input` | 정적 | `TextField` | BankAccountForm | attribute | type=text                |
| 141 | `bankaccount-submit`              | 정적 | `Button`    | BankAccountForm | attribute | type=submit, text="Save" |

## src/components/BankAccountItem.tsx

| 줄  | test id                                   | 종류                  | 요소       | 컴포넌트            | 연결 방식 | UI 특징                |
| --- | ----------------------------------------- | --------------------- | ---------- | ------------------- | --------- | ---------------------- |
| 16  | `bankaccount-list-item-${bankAccount.id}` | 동적 (bankAccount.id) | `ListItem` | BankAccountListItem | attribute | -                      |
| 25  | `bankaccount-delete`                      | 정적                  | `Button`   | BankAccountListItem | attribute | onClick, text="Delete" |

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

| 줄  | test id                       | 종류 | 요소         | 컴포넌트 | 연결 방식 | UI 특징                                                  |
| --- | ----------------------------- | ---- | ------------ | -------- | --------- | -------------------------------------------------------- |
| 132 | `sidenav-toggle`              | 정적 | `IconButton` | NavBar   | attribute | onClick                                                  |
| 140 | `drawer-icon`                 | 정적 | `MenuIcon`   | NavBar   | attribute | -                                                        |
| 142 | `app-name-logo`               | 정적 | `Typography` | NavBar   | attribute | component=h1                                             |
| 163 | `nav-top-new-transaction`     | 정적 | `Button`     | NavBar   | attribute | to=/transaction/new, component=${RouterLink}, text="New" |
| 173 | `nav-top-notifications-link`  | 정적 | `IconButton` | NavBar   | attribute | to=/notifications, component=${RouterLink}               |
| 180 | `nav-top-notifications-count` | 정적 | `Badge`      | NavBar   | attribute | -                                                        |

## src/components/NavDrawer.tsx

| 줄  | test id                  | 종류 | 요소           | 컴포넌트           | 연결 방식 | UI 특징                                                     |
| --- | ------------------------ | ---- | -------------- | ------------------ | --------- | ----------------------------------------------------------- |
| 122 | `sidenav-home`           | 정적 | `ListItem`     | mainListItems      | attribute | onClick, to=/, component=${RouterLink}, button              |
| 135 | `sidenav-user-settings`  | 정적 | `ListItem`     | mainListItems      | attribute | onClick, to=/user/settings, component=${RouterLink}, button |
| 148 | `sidenav-bankaccounts`   | 정적 | `ListItem`     | mainListItems      | attribute | onClick, to=/bankaccounts, component=${RouterLink}, button  |
| 161 | `sidenav-notifications`  | 정적 | `ListItem`     | mainListItems      | attribute | onClick, to=/notifications, component=${RouterLink}, button |
| 179 | `sidenav-signout`        | 정적 | `ListItem`     | secondaryListItems | attribute | onClick, button                                             |
| 209 | `sidenav`                | 정적 | `StyledDrawer` | NavDrawer          | attribute | -                                                           |
| 240 | `sidenav-user-full-name` | 정적 | `Typography`   | NavDrawer          | attribute | -                                                           |
| 247 | `sidenav-username`       | 정적 | `Typography`   | NavDrawer          | attribute | text="@"                                                    |
| 270 | `sidenav-user-balance`   | 정적 | `Typography`   | NavDrawer          | attribute | -                                                           |

## src/components/NotificationList.tsx

| 줄  | test id              | 종류 | 요소   | 컴포넌트          | 연결 방식 | UI 특징 |
| --- | -------------------- | ---- | ------ | ----------------- | --------- | ------- |
| 21  | `notifications-list` | 정적 | `List` | NotificationsList | attribute | -       |

## src/components/NotificationListItem.tsx

| 줄  | test id                                     | 종류                   | 요소             | 컴포넌트             | 연결 방식 | UI 특징                 |
| --- | ------------------------------------------- | ---------------------- | ---------------- | -------------------- | --------- | ----------------------- |
| 93  | `notification-list-item-${notification.id}` | 동적 (notification.id) | `StyledListItem` | NotificationListItem | attribute | -                       |
| 97  | `notification-mark-read-${notification.id}` | 동적 (notification.id) | `IconButton`     | NotificationListItem | attribute | onClick                 |
| 108 | `notification-mark-read-${notification.id}` | 동적 (notification.id) | `Button`         | NotificationListItem | attribute | onClick, text="Dismiss" |

## src/components/SignInForm.tsx

| 줄  | test id              | 종류 | 요소        | 컴포넌트   | 연결 방식 | UI 특징                     |
| --- | -------------------- | ---- | ----------- | ---------- | --------- | --------------------------- |
| 88  | `signin-error`       | 정적 | `Alert`     | SignInForm | attribute | -                           |
| 111 | `signin-username`    | 정적 | `TextField` | SignInForm | attribute | type=text                   |
| 128 | `signin-password`    | 정적 | `TextField` | SignInForm | attribute | type=password               |
| 146 | `signin-remember-me` | 정적 | `Checkbox`  | SignInForm | attribute | -                           |
| 152 | `signin-submit`      | 정적 | `Button`    | SignInForm | attribute | type=submit, text="Sign In" |
| 168 | `signup`             | 정적 | `Link`      | SignInForm | attribute | to=/signup                  |

## src/components/SignUpForm.tsx

| 줄  | test id                  | 종류 | 요소         | 컴포넌트   | 연결 방식 | UI 특징                      |
| --- | ------------------------ | ---- | ------------ | ---------- | --------- | ---------------------------- |
| 81  | `signup-title`           | 정적 | `Typography` | SignUpForm | attribute | component=h1, text="Sign Up" |
| 97  | `signup-first-name`      | 정적 | `TextField`  | SignUpForm | attribute | type=text                    |
| 115 | `signup-last-name`       | 정적 | `TextField`  | SignUpForm | attribute | type=text                    |
| 132 | `signup-username`        | 정적 | `TextField`  | SignUpForm | attribute | type=text                    |
| 149 | `signup-password`        | 정적 | `TextField`  | SignUpForm | attribute | type=password                |
| 166 | `signup-confirmPassword` | 정적 | `TextField`  | SignUpForm | attribute | type=password                |
| 181 | `signup-submit`          | 정적 | `Button`     | SignUpForm | attribute | type=submit, text="Sign Up"  |

## src/components/SkeletonList.tsx

| 줄  | test id         | 종류 | 요소   | 컴포넌트     | 연결 방식 | UI 특징 |
| --- | --------------- | ---- | ------ | ------------ | --------- | ------- |
| 21  | `list-skeleton` | 정적 | `Root` | ListSkeleton | attribute | -       |

## src/components/TransactionAmount.tsx

| 줄  | test id                                | 종류                  | 요소               | 컴포넌트          | 연결 방식 | UI 특징        |
| --- | -------------------------------------- | --------------------- | ------------------ | ----------------- | --------- | -------------- |
| 36  | `transaction-amount-${transaction.id}` | 동적 (transaction.id) | `StyledTypography` | TransactionAmount | attribute | component=span |

## src/components/TransactionCreateStepThree.tsx

| 줄  | test id                                      | 종류 | 요소     | 컴포넌트                   | 연결 방식 | UI 특징                                                      |
| --- | -------------------------------------------- | ---- | -------- | -------------------------- | --------- | ------------------------------------------------------------ |
| 117 | `new-transaction-return-to-transactions`     | 정적 | `Button` | TransactionCreateStepThree | attribute | to=/, component=${RouterLink}, text="Return To Transactions" |
| 128 | `new-transaction-create-another-transaction` | 정적 | `Button` | TransactionCreateStepThree | attribute | onClick, text="Create Another Transaction"                   |

## src/components/TransactionCreateStepTwo.tsx

| 줄  | test id                                | 종류 | 요소        | 컴포넌트                 | 연결 방식 | UI 특징                              |
| --- | -------------------------------------- | ---- | ----------- | ------------------------ | --------- | ------------------------------------ |
| 130 | `transaction-create-form`              | 정적 | `Form`      | TransactionCreateStepTwo | attribute | -                                    |
| 133 | `transaction-create-amount-input`      | 정적 | `TextField` | TransactionCreateStepTwo | attribute | type=text                            |
| 155 | `transaction-create-description-input` | 정적 | `TextField` | TransactionCreateStepTwo | attribute | type=text                            |
| 178 | `transaction-create-submit-request`    | 정적 | `Button`    | TransactionCreateStepTwo | attribute | onClick, type=submit, text="Request" |
| 192 | `transaction-create-submit-payment`    | 정적 | `Button`    | TransactionCreateStepTwo | attribute | onClick, type=submit, text="Pay"     |

## src/components/TransactionDateRangeFilter.tsx

| 줄  | test id                                     | 종류              | 요소            | 컴포넌트                       | 연결 방식 | UI 특징               |
| --- | ------------------------------------------- | ----------------- | --------------- | ------------------------------ | --------- | --------------------- |
| 88  | `transaction-list-filter-date-range-button` | 정적              | `Chip`          | TransactionListDateRangeFilter | attribute | onClick               |
| 99  | `transaction-list-filter-date-range-button` | 정적              | `Chip`          | TransactionListDateRangeFilter | attribute | onClick               |
| 105 | `transaction-list-filter-date-clear-button` | 정적              | `CancelIcon`    | TransactionListDateRangeFilter | attribute | -                     |
| 128 | `transaction-list-filter-date-range`        | 정적              | `RangeCalendar` | TransactionListDateRangeFilter | prop      | -                     |
| 138 | `date-range-filter-drawer`                  | 정적              | `Drawer`        | TransactionListDateRangeFilter | attribute | -                     |
| 145 | `date-range-filter-drawer-close`            | 정적              | `Button`        | TransactionListDateRangeFilter | attribute | onClick, text="Close" |
| 148 | `transaction-list-filter-date-range`        | 정적              | `RangeCalendar` | TransactionListDateRangeFilter | prop      | -                     |
| 185 | `${dataTestId}`                             | 동적 (dataTestId) | `div`           | RangeCalendar                  | attribute | -                     |

## src/components/TransactionDetail.tsx

| 줄  | test id                                        | 종류                  | 요소         | 컴포넌트          | 연결 방식 | UI 특징                                 |
| --- | ---------------------------------------------- | --------------------- | ------------ | ----------------- | --------- | --------------------------------------- |
| 111 | `transaction-detail-header`                    | 정적                  | `Typography` | TransactionDetail | attribute | component=h2, text="Transaction Detail" |
| 120 | `transaction-item-${transaction.id}`           | 동적 (transaction.id) | `Grid`       | TransactionDetail | attribute | -                                       |
| 130 | `transaction-sender-avatar`                    | 정적                  | `Avatar`     | TransactionDetail | attribute | -                                       |
| 135 | `transaction-receiver-avatar`                  | 정적                  | `Avatar`     | TransactionDetail | attribute | -                                       |
| 150 | `transaction-description`                      | 정적                  | `Typography` | TransactionDetail | attribute | -                                       |
| 174 | `transaction-like-count-${transaction.id}`     | 동적 (transaction.id) | `Grid`       | TransactionDetail | attribute | -                                       |
| 178 | `transaction-like-button-${transaction.id}`    | 동적 (transaction.id) | `IconButton` | TransactionDetail | attribute | onClick                                 |
| 192 | `transaction-accept-request-${transaction.id}` | 동적 (transaction.id) | `Button`     | TransactionDetail | attribute | onClick, text="Accept Request"          |
| 206 | `transaction-reject-request-${transaction.id}` | 동적 (transaction.id) | `Button`     | TransactionDetail | attribute | onClick, text="Reject Request"          |

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

| 줄  | test id                                            | 종류 | 요소     | 컴포넌트        | 연결 방식 | UI 특징                                                                   |
| --- | -------------------------------------------------- | ---- | -------- | --------------- | --------- | ------------------------------------------------------------------------- |
| 74  | `transaction-list-empty-create-transaction-button` | 정적 | `Button` | TransactionList | attribute | to=/transaction/new, component=${RouterLink}, text="Create A Transaction" |

## src/components/TransactionListAmountRangeFilter.tsx

| 줄  | test id                                       | 종류 | 요소         | 컴포넌트                         | 연결 방식 | UI 특징               |
| --- | --------------------------------------------- | ---- | ------------ | -------------------------------- | --------- | --------------------- |
| 63  | `transaction-list-filter-amount-range`        | 정적 | `Grid`       | AmountRangeFilter                | attribute | -                     |
| 81  | `transaction-list-filter-amount-range-text`   | 정적 | `Typography` | AmountRangeFilter                | attribute | text="Amount Range:"  |
| 86  | `transaction-list-filter-amount-clear-button` | 정적 | `Button`     | AmountRangeFilter                | attribute | onClick, text="Clear" |
| 99  | `transaction-list-filter-amount-range-slider` | 정적 | `Slider`     | AmountRangeFilter                | attribute | onChange              |
| 117 | `transaction-list-filter-amount-range-button` | 정적 | `Chip`       | TransactionListAmountRangeFilter | attribute | onClick               |
| 145 | `amount-range-filter-drawer`                  | 정적 | `Drawer`     | TransactionListAmountRangeFilter | attribute | -                     |
| 152 | `amount-range-filter-drawer-close`            | 정적 | `Button`     | TransactionListAmountRangeFilter | attribute | onClick, text="Close" |

## src/components/TransactionNavTabs.tsx

| 줄  | test id                | 종류 | 요소   | 컴포넌트           | 연결 방식 | UI 특징                         |
| --- | ---------------------- | ---- | ------ | ------------------ | --------- | ------------------------------- |
| 24  | `nav-transaction-tabs` | 정적 | `Tabs` | TransactionNavTabs | attribute | onChange                        |
| 32  | `nav-public-tab`       | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/, component=${Link}         |
| 33  | `nav-contacts-tab`     | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/contacts, component=${Link} |
| 34  | `nav-personal-tab`     | 정적 | `Tab`  | TransactionNavTabs | attribute | to=/personal, component=${Link} |

## src/components/TransactionTitle.tsx

| 줄  | test id                                  | 종류                  | 요소         | 컴포넌트         | 연결 방식 | UI 특징        |
| --- | ---------------------------------------- | --------------------- | ------------ | ---------------- | --------- | -------------- |
| 44  | `transaction-sender-${transaction.id}`   | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span |
| 52  | `transaction-action-${transaction.id}`   | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span |
| 64  | `transaction-receiver-${transaction.id}` | 동적 (transaction.id) | `Typography` | TransactionTitle | attribute | component=span |

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
| 70  | `user-settings-form`              | 정적 | `Form`      | UserSettingsForm | attribute  | -                        |
| 73  | `user-settings-firstName-input`   | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 90  | `user-settings-lastName-input`    | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 107 | `user-settings-email-input`       | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 124 | `user-settings-phoneNumber-input` | 정적 | `TextField` | UserSettingsForm | inputProps | type=text                |
| 147 | `user-settings-submit`            | 정적 | `Button`    | UserSettingsForm | attribute  | type=submit, text="Save" |

## src/components/UsersList.tsx

| 줄  | test id      | 종류 | 요소   | 컴포넌트  | 연결 방식 | UI 특징 |
| --- | ------------ | ---- | ------ | --------- | --------- | ------- |
| 14  | `users-list` | 정적 | `List` | UsersList | attribute | -       |

## src/containers/BankAccountsContainer.tsx

| 줄  | test id           | 종류 | 요소     | 컴포넌트              | 연결 방식 | UI 특징                                                      |
| --- | ----------------- | ---- | -------- | --------------------- | --------- | ------------------------------------------------------------ |
| 84  | `bankaccount-new` | 정적 | `Button` | BankAccountsContainer | attribute | to=/bankaccounts/new, component=${RouterLink}, text="Create" |

## src/containers/UserOnboardingContainer.tsx

| 줄  | test id                          | 종류 | 요소            | 컴포넌트                | 연결 방식 | UI 특징                |
| --- | -------------------------------- | ---- | --------------- | ----------------------- | --------- | ---------------------- |
| 73  | `user-onboarding-dialog`         | 정적 | `Dialog`        | UserOnboardingContainer | attribute | -                      |
| 74  | `user-onboarding-dialog-title`   | 정적 | `DialogTitle`   | UserOnboardingContainer | attribute | -                      |
| 79  | `user-onboarding-dialog-content` | 정적 | `DialogContent` | UserOnboardingContainer | attribute | -                      |
| 117 | `user-onboarding-logout`         | 정적 | `Button`        | UserOnboardingContainer | attribute | onClick, text="Logout" |
| 128 | `user-onboarding-next`           | 정적 | `Button`        | UserOnboardingContainer | attribute | onClick                |

## id가 없는 상호작용 요소

`pnpm testid:add`로 제안 id를 확인하고, `pnpm testid:add:write`로 반영합니다. 제안이 `-`인 항목은 직접 이름을 정해야 합니다.

| 파일                                          | 줄  | 요소       | 컴포넌트      | 제안 id                              | 비고                                      |
| --------------------------------------------- | --- | ---------- | ------------- | ------------------------------------ | ----------------------------------------- |
| src/components/Footer.tsx                     | 9   | `a`        | Footer        | `footer-cypress-real-world-app-link` | 상호작용 요소                             |
| src/components/NavBar.tsx                     | 150 | `Link`     | NavBar        | `nav-bar-home-link`                  | 상호작용 요소                             |
| src/components/TransactionDateRangeFilter.tsx | 195 | `Calendar` | RangeCalendar | -                                    | 핸들러만 있고 역할이 불분명함 (직접 지정) |

## 같은 정적 id가 여러 곳에 있음

조건부 렌더링처럼 의도한 경우일 수 있습니다. 확인만 하세요.

- `transaction-list-filter-date-range-button` (2곳)
- `transaction-list-filter-date-range` (2곳)
