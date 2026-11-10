# Monorepo Buildup (땀수 기록지)

한 땀 = 작업 하나 + 메모 하나. 각 땀은 검증(타입/테스트/빌드) 후에 기록한다.
측: **FE** (web) / **BE** (api) / **ETC** (루트·공유·도구).
설계 구조 정리는 `LLMS-api-architect.md`에 나중에 한 번에 한다 (본 문서는 작업 기록만).

## 목표 구조

```
apps/web         ← src, index.html, vite.config.ts      (@rwa/web)
apps/api         ← backend, prisma                      (@rwa/api)
packages/shared  ← models, 공용 유틸                     (@rwa/shared)
pnpm-workspace.yaml
```

## 기준선 (작업 전)

- 브랜치: `chore/monorepo-buildup` (분기: `chore/ui-change`, f2df713)
- `pnpm types`: 통과
- `pnpm test:unit:ci`: 11 파일 / 92 테스트 통과 (PostgreSQL 컨테이너 사용)
- 패키지 1개, tsconfig 3개, workspace 설정 없음
- 참고: 루트 `tsconfig.json`의 include에 프론트 컴포넌트(`src/components` 등)가 없다. 즉 `pnpm types`는 프론트 전체를 검사하지 않는다.
- 참고: 실행 중인 `rwa-app` 컨테이너는 이 폴더를 bind mount(`.:/app`)한다. 파일을 옮기는 동안 컨테이너 안의 dev 서버는 깨질 수 있다. ETC 마무리 땀에서 compose를 고친 뒤 다시 올린다.

---

## 땀 기록

<!-- 형식: ### 땀 N [측] 제목 / 한 일 / 의존성 메모 / 검증 -->

### 땀 1 [ETC] workspace 뼈대 + 빈 `@rwa/shared`

- 한 일: `pnpm-workspace.yaml`(`apps/*`, `packages/*`), `packages/shared`(소스 직접 노출: `main`/`types` = `src/index.ts`, 빌드 단계 없음), 루트에 `"@rwa/shared": "workspace:*"` 추가.
- 메모: 아직 루트가 앱 전체를 들고 있다. 루트는 과도기에만 `@rwa/shared`의 소비자이고, 마지막 땀에서 순수 오케스트레이터가 된다.
- 메모: 공유 패키지는 빌드 없이 TS 소스를 그대로 노출한다. Vite와 vitest는 그대로 읽는다. ts-node는 symlink의 실제 경로(`packages/shared`)가 `node_modules` 밖이라 컴파일한다 (다음 땀에서 확인).
- 검증: `pnpm install` 성공(peer 경고 1건은 원래 있던 것: graphql-tools → @apollo/client), `pnpm types` 통과.

### 땀 2 [ETC→FE/BE] `src/models` → `packages/shared/src/models`

- 한 일: `git mv`로 이동(이력 보존). `packages/shared/src/index.ts`가 `export * from "./models"`. FE·BE·테스트 54개 파일의 `../models`, `../../models`, `../src/models`, `../src/models/user`를 모두 `@rwa/shared`로 치환.
- 의존성 메모: models는 외부 패키지를 쓰지 않는다 (내부 import만). 그래서 shared의 `package.json`에 dependencies가 아직 없다.
- 의존성 메모: `backend → ../src/models` 경로가 끊어졌다. BE가 `src`를 더 이상 거치지 않고 shared를 통한다. 남은 BE→`src` 의존은 `transactionUtils`, `portUtils`, `aws-exports` 3개.
- 발견: `scripts/tsconfig.json`의 `"../models"`는 이전부터 없는 경로였다 (이번 이동과 무관). ETC 정리 땀에서 같이 정리한다.
- 검증: `pnpm types` 통과. ts-node가 `@rwa/shared`(TS 소스)를 컴파일해서 `backend/user-db`를 로드함. vitest 3개 파일(14 테스트) 통과.

### 땀 3 [ETC→FE/BE] `transactionUtils` → `@rwa/shared`

- 한 일: `transactionUtils.ts`와 그 테스트를 `packages/shared`로 `git mv`. 파일 안의 models import는 `./models`로(자기 패키지 순환 방지). FE 9개 + BE 4개 파일의 import를 `@rwa/shared`로 치환.
- 의존성 메모 (shared가 스스로 선언): `@faker-js/faker`, `date-fns`, `date-fns-tz`, `dinero.js`, `lodash`. dev는 `@types/lodash`, `shortid`, `@types/shortid` (테스트용). 루트에도 같은 패키지가 남아 있다 — FE·BE가 아직 직접 쓰기 때문이고, 각 앱이 분리될 때 걷어낸다.
- 의존성 메모: `faker`가 shared의 일반 dependency다. `getFakeAmount`가 이걸 쓰기 때문이다. FE 번들에 faker가 들어가는 건 원래도 그랬다 (이동 전에도 같은 파일이 번들에 포함). 나중에 faker 의존 함수만 `test-utils`로 빼면 번들이 줄어든다 — **보류 항목**.
- 이제 BE→`src` 의존은 `portUtils`, `aws-exports` 2개만 남음.
- 주의: ts-node 직접 검증은 `--files`가 필요하다 (`backend/types.ts`의 `req.user` 타입 확장 때문). `start:api` 스크립트는 이미 `--files`를 쓴다. 이건 이동과 무관한 기존 동작.
- 검증: `pnpm types` 통과, 전체 vitest 11 파일 / 92 테스트 통과 (shared 테스트가 `packages/shared`에서 실행됨), ts-node `--files`로 `transaction-routes`·`notification-api` 로드 OK.

### 땀 4 [BE] BE에 남은 `src` 의존 제거 (`portUtils`, `aws-exports`)

- 한 일 (1): `src/utils/portUtils.ts` → `backend/port-utils.ts` (`git mv`). `backend/app.ts`는 `./port-utils`를 쓴다. 루트 `tsconfig.json`의 include에서 `src/utils/portUtils.ts` 항목 삭제.
- 한 일 (2): `scripts/testServer.ts`는 `frontendPort`를 `process.env.PORT`로 직접 읽는다. 이 파일은 웹 쪽 서버(정적 + `/api` 프록시)라 FE 이동 땀에서 `apps/web`으로 간다.
- 한 일 (3): `backend/helpers.ts`가 `../src/aws-exports`를 import하던 것을 `AWS_COGNITO_USER_POOL_ID` 환경변수로 교체 (기본값은 mock의 자리표시자 `us-east-1_abcdefghi`). `.env.example`에 주석 한 줄 추가.
- 의존성 메모: `aws-exports.js`는 gitignore 대상이다. 이전에는 새로 clone하면 `src/aws-exports.js`가 없어서 API가 시작 시점에 죽는 구조였다. 이제 BE는 FE 파일 없이 뜬다. 이 땀의 가장 중요한 효과다.
- 의존성 메모: Cognito 로그인은 `VITE_AWS_COGNITO`를 켤 때만 쓰이고, 실제 풀 ID가 필요하면 `.env`에 `AWS_COGNITO_USER_POOL_ID`를 넣어야 한다. 동작 변화는 이 경우에만 있다. **사용자 확인 필요 항목** (Cognito를 실제로 쓸 계획이 있으면 알려주세요).
- 의존성 메모: `portUtils`의 `chalk`, `detect-port`는 이제 BE 전용이다. api 패키지로 갈 때 같이 간다.
- 의존성 메모: CORS origin(`localhost:${frontendPort}`) 하드코딩은 그대로다. 설계 단계(`LLMS-api-architect.md`)에서 다룬다.
- 결과: **BE → `src` 직접 의존이 0개**가 되었다. BE가 FE 디렉토리를 건드리는 곳은 없다.
- 검증: `pnpm types` 통과. ts-node `--files`로 `helpers`, `port-utils` 로드 OK. API를 7299 포트로 실제 기동해서 `GET /api` → 200, `GET /api/checkAuth` → 401 확인 후 종료 (7299 포트 비어 있음 확인).

### 땀 5 [BE] `backend` + `prisma` + DB 테스트 → `apps/api` (`@rwa/api`)

- 한 일 (이동, 전부 `git mv`): `backend/` → `apps/api/src/`, `prisma/` → `apps/api/prisma/`, `src/__tests__/` → `apps/api/src/__tests__/`. 테스트의 `../../backend/X`는 `../X`로.
- 한 일 (패키지): `apps/api/package.json`(서버 런타임은 `dependencies`, 타입·도구는 `devDependencies`로 정리), `tsconfig.json`(commonjs, `include: ["src"]`), `vitest.config.ts`(node 환경, DB setup 파일 연결).
- 의존성 메모 (정리됨): 이전에는 express·passport·bcryptjs 등 서버 런타임이 루트 `devDependencies`에 있었다. 이제 `@rwa/api`의 `dependencies`다. API 전용 프로덕션 이미지를 만들 수 있는 상태가 되었다.
- 의존성 메모 (`.env`): `.env`는 계속 **루트 한 곳**이다. 하지만 api는 자기 폴더(`apps/api`)에서 실행되므로 `dotenv.config()`가 루트 `.env`를 못 찾는다. 해결: `src/load-env.ts`(현재 폴더 → 루트 순서로 로드, 이미 설정된 환경변수는 덮어쓰지 않음)를 `app.ts`·`helpers.ts`·`prisma.ts`·`testDb.ts`의 맨 앞에서 import. Docker compose가 주는 환경변수가 파일보다 우선하는 동작은 그대로다.
- 의존성 메모 (Prisma CLI): CLI도 루트 `.env`를 못 찾으므로 `dotenv-cli`를 api devDependency로 추가하고 `prisma:cli` 스크립트(`dotenv -e ../../.env -- prisma`)로 감쌌다. `prisma:generate`, `prisma:migrate`는 이 위에서 돈다. 루트 `package.json`에서 `prisma`, `@prisma/client`는 삭제.
- 의존성 메모 (테스트): 루트 `vite.config.ts`의 `test` 블록(jsdom + DB setup)을 삭제하고 각 패키지가 자기 vitest 설정을 가진다. DB 테스트는 파일마다 이미 `// @vitest-environment node`를 달고 있어서 환경 변화는 없다. 이전에 루트 설정이 `process.env`를 `VITE_*` 객체로 치환(`define`)하던 영향도 이 테스트에서 사라졌다.
- 동작 변화 (**확인 필요**): `app.use(express.static(join(__dirname, "../public")))`를 삭제했다. 이 줄은 이전에 웹의 `public/`(favicon, manifest, readme 스크린샷 등)을 7202 포트에서도 서빙했다. `public/`은 웹 자산이고 API 코드는 이 파일들을 참조하지 않는다. 모바일 앱이 7202에서 이 정적 파일을 받아 쓰고 있었다면 알려주세요.
- 루트 연결: `start:api`, `start:api:watch`, `docker:dev`의 api 부분, `prisma:migrate`, `types`, `test:unit(:ci)`를 `pnpm --filter @rwa/api ...` 또는 `pnpm -r`로 바꿨다. 루트 `tsconfig.json` include에서 `backend`, `src/__tests__` 삭제.
- **알려진 임시 파손**: `Dockerfile`이 아직 `COPY prisma ./prisma`, `pnpm exec prisma generate`를 쓴다. 이 경로는 이제 없다 → `docker compose build`는 ETC 마무리 땀(Docker 정비) 전까지 실패한다. 실행 중인 컨테이너는 bind mount 때문에 옛 경로를 찾지 못해 dev 서버가 깨질 수 있다.
- 사고 기록: 스모크 테스트용으로 띄운 API 서버(7299)가 종료되지 않고 남아 Prisma 엔진 DLL을 잠갔다 (`prisma generate`가 EPERM). 제가 띄운 PID만 골라 종료했다. 이후 스모크 테스트는 스스로 종료하는 스크립트로 한다.
- 검증: `pnpm types`(루트 + api) 통과. `pnpm prisma:generate` 성공(루트 `.env` 로드 확인). `pnpm test:unit:ci` → shared 6 + api 86 = **92 테스트 통과** (이전과 동일). `pnpm start:api`로 7299에 기동: `GET /api` 200, `GET /api/checkAuth` 401, 잘못된 로그인 401, `GET /api/testData/users` 200 (DB 접속 확인). 종료 후 7299 비어 있음 확인.

### 땀 6 [FE] `src` + Vite 설정 → `apps/web` (`@rwa/web`)

- 한 일 (이동, 전부 `git mv`): `src/`, `index.html`, `public/`, `vite.config.ts`, `patches/`, `amplify/`, `tsconfig*.json`, `scripts/{testServer.ts, generateTestIdList.ts, mock-aws-exports*.js, tsconfig.json}` → `apps/web/`. (gitignore 대상 `aws-exports-es5.js`, `src/aws-exports.js`도 같이 옮겨 로컬 환경 유지.) 루트 `scripts/` 폴더는 비어서 삭제.
- 의존성 분할 (자동 스크립트로 계산, 누락 0): 루트의 옛 `dependencies`/`devDependencies`를 (루트 도구 / api·shared 소유 / web) 세 곳에 나눠 담았다. 결과: 루트 devDeps 15개(eslint·prettier·husky·playwright·typescript 등 저장소 공통 도구만), web deps 32 + devDeps 42. 루트는 `private: true` 오케스트레이터가 되었다.
- 의존성 메모 (`.env`): `vite.config.ts`가 루트 `.env`를 `loadEnv(mode, rootDir, ...)`와 `envDir`로 읽는다. `src/setupProxy.js`(테스트용 정적 서버가 사용)도 같은 방식. `.env`는 계속 **루트 한 곳**.
- 의존성 메모 (패치): `patch-package`의 `postinstall`을 루트에서 web으로 옮겼다. `react-virtualized` 패치는 web 의존성이므로 web 폴더에서 적용되어야 한다 (`apps/web/patches`). 루트 `postinstall`은 `husky install`만 남음. 설치 후 수동 실행으로 `react-virtualized@9.22.5 ✔` 확인.
- 의존성 메모 (타입 검사 분리): `vite.config.ts`는 Vite 8의 ESM 전용 타입 때문에 `moduleResolution: node`로는 검사되지 않는다. `tsconfig.node.json`(bundler 해석, `vite-plugin-eslint` 타입은 `paths`로 연결)으로 분리. `pnpm types`(web) = 도구(vite.config + scripts), `pnpm types:full` = FE `src` 전체.
- **기준선 (이동과 무관한 기존 문제)**: FE `src` 전체 타입 검사(`types:full`)는 이번이 사실상 처음이고 **오류 23개**다 (formik 렌더 prop 암묵적 any, `history` 타입 없음, `react-virtualized` List JSX 타입, Okta/Auth0 prop 타입 등). 이전 루트 `tsconfig.json`은 FE 컴포넌트를 검사 대상에 넣지 않았다. 모듈 해석 오류(`@rwa/shared` 못 찾음 등)는 0건. 고치는 일은 별도 땀으로 미룬다.
- **기준선 (기존)**: `pnpm testid:check`는 이동 전부터 실패한다. 문서(`testid-listup.md`)의 줄 번호가 오래됐고(예: `signin-submit` 문서 152 vs 실제 160행→indexer 154), id 없는 요소가 3개 있다. 이동 후 재생성하면 줄 번호 11줄이 바뀔 뿐이라 되돌렸다. 인덱서 출력 경로는 루트 `testid-listup.md`로 유지(`OUTPUT`을 `../..` 기준으로).
- 정리 후보 (손대지 않음): web에 남은 미사용 추정 패키지 — `webpack`, `babel-loader`, `graphql-tools`, `@types/{bluebird,connect-flash,json-server,jwt-decode,serve-static,...}`, `@mui/lab`, `@babel/plugin-*`. 이동과 분리해서 나중에 한 번에 판단한다.
- 루트 연결: `start:react`, `start:react:proxy-server`, `build`, `build:ci`, `predev:cognito(:ci)`, `testid:*`, `docker:dev`의 web 부분을 `pnpm --filter @rwa/web ...`으로. `tsnode`, `tsnode:not-instrumented`는 쓰는 곳이 없어 삭제. 루트 `tsconfig.json`은 `e2e` + `playwright.config.ts`만 포함하는 새 파일.
- 검증: `pnpm types`(루트+api+web) 통과. `vite build` 성공 — 출력 번들 이름이 이전 루트 빌드와 같다 (`index-ePTdWChf.js`), 즉 번들 내용 동일. `pnpm start`(루트)로 web(7298)+api(7299) 동시 기동: web `/` 200, `/src/index.tsx` 200, 프록시 `/api` 200, `/api/checkAuth` 401. 스모크 스크립트가 자기 프로세스만 종료했고 7298/7299 비어 있음, `node.exe` 0개 확인.

### 땀 7 [ETC] Docker 정비 + 문서 경로 정리

- 한 일 (Docker): `Dockerfile`이 워크스페이스 매니페스트(`apps/*/package.json`, `packages/shared/package.json`, `pnpm-workspace.yaml`)만 먼저 복사해 설치 레이어를 캐시한다. `prisma generate`는 `pnpm --filter @rwa/api exec prisma generate`, 패치는 `pnpm --filter @rwa/web exec patch-package`. `.dockerignore`는 `**/node_modules`, `**/build`로 넓혔다 (패키지마다 `node_modules`가 있기 때문).
- 의존성 메모 (볼륨): 패키지마다 `node_modules`가 따로 있다. 호스트 폴더를 bind mount하면 Windows 호스트의 `node_modules`(Windows 경로를 가리키는 링크)가 컨테이너에 비쳐 깨진다. 그래서 compose에 `node-modules-{root,web,api,shared}` 네 개의 named volume을 두었다.
- 의존성 메모 (옛 볼륨): 옛 볼륨 `app-node-modules`(compose 프로젝트 이름 접두사 포함)는 더 이상 쓰지 않는 고아 볼륨이다. 데이터 볼륨(`rwa-pgdata`)을 지울 위험 때문에 `down -v`를 쓰지 않았고 옛 볼륨도 지우지 않았다. 필요하면 `docker volume ls`로 확인 후 직접 `docker volume rm` 하면 된다.
- 한 일 (문서): README의 경로 7곳(테스트 위치, prisma, `*-db.ts`, mock aws-exports, 인증 제공자별 `index.*.tsx`)을 새 경로로. 코드 주석 2곳. `lowdb-delete.md`는 지난 마이그레이션의 역사 기록이라 그대로 둔다.
- 검증 (Docker): `docker compose build app` 성공, `docker compose up -d --wait`로 `rwa-app` 재생성 → healthy (postgres는 그대로 유지, 9시간 가동). 호스트에서 7201 `/` 200, 7202 `/api` 200, 프록시 `7201/api/checkAuth` 401, `7202/api/testData/users` 200(DB). 컨테이너 안 `node_modules`가 리눅스 링크임을 확인.

### 땀 8 [ETC] 명령어 호환 점검: 설치와 Docker가 web/api로 갈라지지 않게

- 요구: 설치나 Docker 올리기가 web용, api용으로 나뉘면 안 된다. 이동 전 스크립트가 같은 이름으로 같게 도는지 확인한다.
- 비교 방법: `git show HEAD:package.json`의 스크립트 50여 개와 지금의 루트 스크립트를 이름 단위로 대조했다.
- 발견: 루트에서 사라진 이름 5개. `copy:mock:awsexports`, `copy:mock:awsexportses5`, `build:aws-exports-es5` (web으로 내려가 있었음), `tsnode`, `tsnode:not-instrumented`.
- 한 일: 앞의 3개를 루트에 별칭으로 되살렸다 (`pnpm --filter @rwa/web ...`). `predev:cognito:ci`는 옛 정의(`copy:mock:awsexports && copy:mock:awsexportses5`) 그대로 루트에 둔다.
- 하지 않은 일: `tsnode` 두 개는 되살리지 않았다. 옛 `tsnode`는 루트의 `tsconfig.tsnode.json`을 쓰는 내부 도우미였고, 지금은 쓰는 곳이 없다 (`start:api`와 `codesandbox:start:api`가 `ts-node`를 직접 부른다). 되살리면 인자 경로의 기준 폴더가 달라져 이름만 같고 동작이 다른 별칭이 된다.
- 설치: 루트에서 `pnpm install` 한 번이면 web, api, shared가 모두 설치된다. web의 `patch-package`는 설치 중에 자동으로 적용된다 (`apps/web postinstall`). Prisma 클라이언트는 이동 전과 같다: `onlyBuiltDependencies`가 `esbuild`뿐이라 설치 중에는 생성되지 않고, README 순서의 `pnpm prisma:migrate`가 마이그레이션 후 생성한다 (직접 하려면 `pnpm prisma:generate`).
- Docker: `docker:up/down/reboot/logs/status`는 이동 전과 같은 문자열이고, 컨테이너 하나(`rwa-app`)가 web과 api를 같이 올린다. 설치와 Docker 명령은 web용, api용으로 나뉘지 않는다.
- 검증 (새 clone 상태): 스테이징된 파일만 빈 폴더에 꺼내(`.env`와 `node_modules` 없음) 루트에서 `pnpm install --frozen-lockfile` 한 번 실행. 이어서 `prisma:generate`, `types`(루트+api+web) 통과, `test:unit:ci` 92개 통과 (shared 6 + api 86), `predev:cognito:ci`가 두 파일 생성, `build` 성공. `pnpm dev`와 `pnpm start:ci`를 빈 포트(7298/7299)에서 기동: web `/` 200, api `/api` 200, 프록시 `/api/checkAuth` 401. 스모크가 자기 프로세스만 종료했고 `node.exe` 0개 확인.
- 점검 중 실수: 새 clone 폴더에 `.env.example`을 `.env`로 넣었더니 DB 계정이 달라 테스트 82개가 인증 오류로 실패했다. 모노레포 문제가 아니라 내 점검 환경 문제였고, 실제 `.env`로 바꿔 92개 통과를 확인한 뒤 임시 폴더(복사한 `.env` 포함)를 지웠다.

---

## 현재 상태 요약

```
apps/web         @rwa/web     React + Vite        (src, public, index.html, vite.config.ts, scripts, patches, amplify)
apps/api         @rwa/api     Express + Prisma    (src, prisma, 테스트)
packages/shared  @rwa/shared  모델 타입 + transactionUtils (소스 직접 노출, 빌드 없음)
루트             오케스트레이터 (e2e, playwright, docker, eslint/prettier, husky, 문서)
```

- 의존 방향: `web → shared ← api`. **web ↔ api 직접 import는 0건.** (이전: BE가 `../src/*`를 20곳에서 import.)
- `.env`는 계속 루트 한 곳. web은 `vite.config.ts`, api는 `src/load-env.ts`, Prisma CLI는 `dotenv-cli`로 같은 파일을 읽는다.
- 검증 (최종): `pnpm types` 통과 / `pnpm test:unit:ci` shared 6 + api 86 = **92 통과** (기준선과 동일) / ESLint 통과 / `vite build` 성공(번들 해시 동일) / Playwright chromium 스모크 1건 통과(Docker 앱 대상).
- 브랜치 `chore/monorepo-buildup`. **커밋하지 않았다** (이동은 모두 `git mv`라 `git status`에서 rename으로 보인다).

## 열려 있는 항목 (이동과 무관하거나 판단이 필요한 것)

| #   | 측  | 내용                                                                                                                     | 비고                                |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | BE  | `express.static(public)` 삭제 (땀 5). 모바일 앱이 7202에서 정적 파일을 받는지 확인 필요                                  | 사용자 확인                         |
| 2   | BE  | `AWS_COGNITO_USER_POOL_ID` 환경변수 도입 (땀 4). Cognito를 실제로 쓸 계획이 있는지                                       | 사용자 확인                         |
| 3   | FE  | `types:full` 오류 23개 (formik 암묵적 any, `history` 타입 등)                                                            | 기존 문제, 별도 땀                  |
| 4   | FE  | `testid:check` 실패 (문서 줄 번호 stale, id 없는 요소 3개)                                                               | 기존 문제                           |
| 5   | ETC | Prettier 경고 3건 (`transactionFiltersMachine.ts`, `notification.ts`, `LLMS.md`)                                         | 이동 전부터 있던 것                 |
| 6   | ETC | 미사용 추정 패키지 정리 (`webpack`, `babel-loader`, `graphql-tools`, 쓰지 않는 `@types/*`, `@mui/lab` 등)                | 땀 6 참고                           |
| 7   | ETC | 루트 `build/`(옛 빌드 산출물, gitignore 대상)와 고아 Docker 볼륨 `app-node-modules`                                      | 로컬 정리만                         |
| 8   | BE  | 설계 항목: CORS origin 하드코딩, session secret 하드코딩·MemoryStore, 쿠키 설정, 로그아웃 redirect, 모바일 인증(토큰) 등 | `LLMS-api-architect.md`에서 한 번에 |
| 9   | ETC | `faker`가 shared 런타임 의존 → FE 번들에 포함 (원래도 동일). 테스트용 함수 분리 시 번들 감소                             | 보류                                |
| 10  | ETC | `LLMS.md` Done 목록에 모노레포화 반영                                                                                    | LLMS.md 규칙상 사용자 허락 필요     |
