<p align="center">
  <!-- We use two SVGs here so that this displays correctly
    on Github. This might not look right in other Markdown previewers. -->
  <img alt="Cypress Real World App Logo" src="./src/svgs/rwa-logo-light.svg#gh-dark-mode-only" />
  <img alt="Cypress Real World App Logo" src="./src/svgs/rwa-logo.svg#gh-light-mode-only" />
</p>

<p align="center">
A payment application used as a portfolio project for <strong>end-to-end testing with <a href="https://playwright.dev">Playwright</a></strong>. Forked from the <a href="https://github.com/cypress-io/cypress-realworld-app">Cypress Real World App</a>.
</p>

<p align="center">
  <img style='width: 70%' alt="Cypress Real World App" src="./public/img/rwa-readme-screenshot.png" />
</p>

> 💬 **Note from maintainers**
>
> This application is purely for demonstration and educational purposes. Its setup and configuration resemble typical real-world applications, but it's not a full-fledged production system. Use this app to learn, experiment, tinker, and practice application testing with Cypress.
>
> Happy Testing!

---

## License Compliance

This repository is a personal fork of the [Cypress Real World App](https://github.com/cypress-io/cypress-realworld-app), originally created by Cypress.io and distributed under the [MIT License](LICENSE).

I am using this project **solely for non-commercial purposes**, namely personal learning and as part of my portfolio to demonstrate my test automation skills. In accordance with the terms of the MIT License:

- The original copyright notice and the MIT License text (see [LICENSE](LICENSE)) are retained in this repository and in all copies or substantial portions of the software.
- All rights to the original work remain with its copyright holder, Copyright (c) 2020 Cypress.io. This fork is not affiliated with, endorsed by, or sponsored by Cypress.io.
- The software is provided "as is", without warranty of any kind, express or implied, and I accept no liability for any claim or damages arising from its use.
- Any modifications I make are my own and are likewise shared under the terms of the MIT License.

**한국어 안내**

이 저장소는 Cypress.io가 만들고 [MIT 라이선스](LICENSE)로 배포한 [Cypress Real World App](https://github.com/cypress-io/cypress-realworld-app)을 개인적으로 포크한 것입니다.

저는 이 프로젝트를 **오직 비상업적 목적**, 즉 개인 학습과 테스트 자동화 역량을 보여주기 위한 포트폴리오 용도로만 사용합니다. MIT 라이선스 조건에 따라 다음을 준수합니다.

- 원저작자의 저작권 고지와 MIT 라이선스 전문([LICENSE](LICENSE))을 이 저장소와 모든 사본 또는 주요 부분에 그대로 유지합니다.
- 원본에 대한 모든 권리는 원저작권자(Copyright (c) 2020 Cypress.io)에게 있으며, 이 포크는 Cypress.io와 제휴, 보증, 후원 관계가 없습니다.
- 소프트웨어는 명시적이든 묵시적이든 어떠한 보증도 없이 "있는 그대로" 제공되며, 사용으로 인한 어떠한 청구나 손해에 대해서도 책임을 지지 않습니다.
- 제가 수정한 부분 역시 MIT 라이선스 조건에 따라 공유됩니다.

---

## Features

🛠 Built with [React][reactjs], [XState][xstate], [Express][express], [lowdb][lowdb], [Material-UI][material-ui] and [TypeScript][typescript]
⚡️ Zero database dependencies
🚀 Full-stack [Express][express]/[React][reactjs] application with real-world features and tests
👮‍♂️ Local Authentication
🔥 Database Seeding with End-to-end Tests
🎭 End-to-end tests with [Playwright](https://playwright.dev)

## Getting Started

The app is a full-stack Express/React application backed by a local JSON database ([lowdb]).

The app is bundled with [example data](./data/database.json) (`data/database.json`) that contains everything you need to start using the app and run tests out-of-the-box.

> 🚩 **Note**
>
> You can login to the app with any of the [example app users](./data/database.json#L2). The default password for all users is `s3cret`.
> Example users can be seen by running `pnpm list:dev:users`.

### Prerequisites

This project requires [Node.js](https://nodejs.org/en/) to be installed on your machine. Refer to the [.node-version](./.node-version) file for the exact version.

[pnpm](https://pnpm.io/) is used as the package manager. If you have Node.js' [Corepack](https://nodejs.org/dist/latest/docs/api/corepack.html) enabled, the version pinned in `package.json` (`packageManager`) is used automatically:

```shell
corepack enable
```

Otherwise, install pnpm globally:

```shell
npm install pnpm -g
```

### Installation

To clone the repo to your local system and install dependencies, execute the following commands:

```shell
git clone https://github.com/wonderwall1995/cypress-realworld-for-portfolio
cd cypress-realworld-for-portfolio
cp .env.example .env   # local settings; .env itself is git-ignored
pnpm install
pnpm playwright:install
```

### Run the app

```shell
pnpm dev
```

> 🚩 **Note**
>
> The app will run on port `3000` (frontend) and `3001` (API backend) by default. Please make sure there are no other applications or services running on both ports.
> If you want to change the default ports, you can do so by modifying `PORT` and `VITE_BACKEND_PORT` variables in `.env` file.
> If you change the frontend port, also update `baseURL` and `webServer.url` in [playwright.config.ts](./playwright.config.ts).

### Run the Playwright tests

```shell
pnpm test          # run all tests headless (starts the app automatically if it is not running)
pnpm test:ui       # Playwright UI mode
pnpm test:headed   # run in headed browsers
pnpm test:report   # open the last HTML report
```

## Tests

| Type | Location                           |
| ---- | ---------------------------------- |
| e2e  | [e2e](./e2e) (Playwright)          |
| unit | [`src/__tests__`](./src/__tests__) |

Unit tests run with `pnpm test:unit`.

## Database

- The local JSON database is located in [data/database.json](./data/database.json) and is managed with [lowdb].

- The database is [reseeded](./data/database-seed.json) each time the application is started (via `pnpm dev`).

- Updates via the React frontend are sent to the [Express][express] server and handled by a set of [database utilities](backend/database.ts)

- Generate a new database using `pnpm db:seed`.

- An [empty database seed](./data/empty-seed.json) is provided along with a script (`pnpm start:empty`) to view the application without data.

## Additional NPM Scripts

| Script         | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| dev            | Starts backend in watch mode and frontend                                  |
| dev:auth0      | Starts backend in watch mode and frontend; [Uses Auth0](#auth0)            |
| dev:okta       | Starts backend in watch mode and frontend; [Uses Okta](#okta)              |
| dev:cognito    | Starts backend in watch mode and frontend; [Uses Cognito](#amazon-cognito) |
| dev:google     | Starts backend in watch mode and frontend; [Uses Google](#google)          |
| start          | Starts backend and frontend                                                |
| types          | Validates types                                                            |
| db:seed        | Generates fresh database seeds for json files in /data                     |
| start:empty    | Starts backend and frontend with empty database seed                       |
| tsnode         | Customized ts-node command                                                 |
| list:dev:users | Provides id and username for users in the dev database                     |

For a complete list of scripts see [package.json](./package.json)

## 3rd Party Authentication Providers

Support for 3rd party authentication is available in the application to demonstrate the concepts on logging in with a 3rd party provider.

The app contains different entry points for each provider. There is a separate **index** file for each provider, and to use one, you must replace the current **index.tsx** file with the desired one. The following providers are supported:

- [Auth0](#auth0) (index.auth0.tsx)
- [Okta](#okta) (index.okta.tsx)
- [Amazon Cognito](#amazon-cognito) (index.cognito.tsx)
- [Google](#google) (index.google.tsx)

### Auth0

Prerequisites include an Auth0 account and a Tenant configured for use with a SPA. Environment variables from Auth0 are to be placed in the [.env](./.env). For more details see [Auth0 Application Setup](http://on.cypress.io/auth0#Auth0-Application-Setup) and [Setting Auth0 app credentials in Cypress](http://on.cypress.io/auth0#Setting-Auth0-app-credentials-in-Cypress).

To start the application with Auth0, replace the current **src/index.tsx** file with the **src/index.auth0.tsx** file and start the application with `pnpm dev:auth0`.

### Okta

A [guide has been written with detail around adapting the RWA](http://on.cypress.io/okta) to use [Okta][okta].

Prerequisites include an [Okta][okta] account and [application configured for use with a SPA][oktacreateapp]. Environment variables from [Okta][okta] are to be placed in the [.env](./.env).

To start the application with Okta, replace the current **src/index.tsx** file with the **src/index.okta.tsx** file and start the application with `pnpm dev:okta`.

### Amazon Cognito

A [guide has been written with detail around adapting the RWA](http://on.cypress.io/amazon-cognito) to use [Amazon Cognito][cognito] as the authentication solution.

Prerequisites include an [Amazon Cognito][cognito] account. Environment variables from [Amazon Cognito][cognito] are provided by the [AWS Amplify CLI][awsamplify].

- A user pool is required (identity pool is not used here)
  - The user pool must have a hosted UI domain configured, which must:
    - allow callback and sign-out URLs of `http://localhost:3000/`,
    - allow implicit grant Oauth grant type,
    - allow these OpenID Connect scopes:
      - aws.cognito.signin.user.admin
      - email
      - openid
  - The user pool must have an app client configured, with:
    - enabled auth flow `ALLOW_USER_PASSWORD_AUTH`, only for programmatic login flavor of test.
    - The `cy.origin()` flavor of test only requires auth flow `ALLOW_USER_SRP_AUTH`, and does not require `ALLOW_USER_PASSWORD_AUTH`.
  - The user pool must have a user corresponding to the `AWS_COGNITO` env vars mentioned below, and the user's Confirmation Status must be `Confirmed`. If it is `Force Reset Password`, then use a browser to log in once at `http://localhost:3000` while `pnpm dev:cognito` is running to reset their password.

The test knobs are in a few places:

- The `.env` file has `VITE_AUTH_TOKEN_NAME` and vars beginning `AWS_COGNITO`. Be careful not to commit any secrets.
- Both `scripts/mock-aws-exports.js` and `scripts/mock-aws-exports-es5.js` must have the same data; only their export statements differ. These files can be edited manually or exported from the amplify CLI.

To start the application with Cognito, replace the current **src/index.tsx** file with the **src/index.cognito.tsx** file and start the application with `pnpm dev:cognito`.

### Google

A [guide has been written with detail around adapting the RWA](https://docs.cypress.io/guides/testing-strategies/google-authentication.html) to use [Google][google] as the authentication solution.

Prerequisites include an [Google][google] account. Environment variables from [Google][google] are to be placed in the [.env](./.env).

To start the application with Google, replace the current **src/index.tsx** file with the **src/index.google.tsx** file and start the application with `pnpm dev:google`.

## License

[![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/cypress-io/cypress/blob/master/LICENSE)

This project is licensed under the terms of the [MIT license](/LICENSE).

[reactjs]: https://reactjs.org
[xstate]: https://xstate.js.org
[express]: https://expressjs.com
[lowdb]: https://github.com/typicode/lowdb
[typescript]: https://typescriptlang.org
[material-ui]: https://material-ui.com
[okta]: https://okta.com
[auth0]: https://auth0.com
[oktacreateapp]: https://developer.okta.com/docs/guides/sign-into-spa/react/create-okta-application/
[cognito]: https://aws.amazon.com/cognito
[awsamplify]: https://amplify.aws
[google]: https://google.com

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://www.kevinold.com"><img src="https://avatars0.githubusercontent.com/u/21967?v=4" width="100px;" alt=""/><br /><sub><b>Kevin Old</b></sub></a></td>
    <td align="center"><a href="https://twitter.com/amirrustam"><img src="https://avatars0.githubusercontent.com/u/334337?v=4" width="100px;" alt=""/><br /><sub><b>Amir Rustamzadeh</b></sub></a></td>
    <td align="center"><a href="https://twitter.com/be_mann"><img src="https://avatars2.githubusercontent.com/u/1268976?v=4" width="100px;" alt=""/><br /><sub><b>Brian Mann</b></sub></a></td>
    <td align="center"><a href="https://glebbahmutov.com/"><img src="https://avatars1.githubusercontent.com/u/2212006?v=4" width="100px;" alt=""/><br /><sub><b>Gleb Bahmutov</b></sub></a></td>
    <td align="center"><a href="http://www.bencodezen.io"><img src="https://avatars0.githubusercontent.com/u/4836334?v=4" width="100px;" alt=""/><br /><sub><b>Ben Hong</b></sub></a></td>
    <td align="center"><a href="https://github.com/davidkpiano"><img src="https://avatars2.githubusercontent.com/u/1093738?v=4" width="100px;" alt=""/><br /><sub><b>David Khourshid</b></sub></a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!!
