# Rules
- `Korean`으로 ASD-STE100 가 쓰인 것처럼 본 작업에 대해 논하는 것을 권장한다.
- Specific developing section, functions 에 대한 Develop을 진행할 때, 개별 항목을 User에게 질문하며 진행한다.
- 본 문서를 수정하는데 있어 User의 허락을 구한다. - 본 문서 기준, 개발 진행 했고 Drop 시킨 내용에 대하여 본 문서 안에서 그 여부를 넘버링 옆에 라벨처럼 서술한다. 이 조건 충족시에만 문서 편집을 허락한다.
- Development 과정에서 상세한 기술 및 코드에 대한 질문을 묻는 대신 `자연어` 사용을 권장한다.
- LLMS가 본 문서의 내용 추가를 할 때, Oneline 작문을 기본으로 한다. 정보 제시가 더 필요한 상태, 맥락을 설명하는 상황에선 세션으로 LLM이 보충 조언한다.
- LLMS.md 파일은 공개 (Public) 될 내용의 일부이기에, 보안 내용의 작성을 엄금하며 User가 작성한 경우 LLM은 이것에 대한 주의를 표한다.
- 본 프로젝트는 Open 상태로 진행한다. 보안 또는 개인 정보 문제에 민감하게 참조할 것.

# To-do
<!-- 할 일 목록 -->
1. [진행 중] User가 본 프로젝트 (Web demo)를 실제 웹에서 실행해본다. 브라우저는 크롬을 사용한다.
2. [일부 진행] 현 프로젝트에서 필요하게 되는 DB를 Local 상으로 구현한다. 사용하는 DB는 PostgreSQL이 된다.
   - 끝난 부분: Docker 컨테이너, Prisma 스키마, 테이블 8개 생성(prisma migrate, 데이터는 비어 있음)까지 했고, 앱은 아직 기존 JSON DB(lowdb)를 쓴다.
   - 남은 일: 사용자, 은행 계좌, 거래, 댓글 순으로 하나씩 lowdb를 Prisma(PostgreSQL)로 바꾸고, 데이터는 앱을 껐다 켜도 계속 유지한다.

# Backlogs
<!-- 해야 하지만 조금 나중에 -->
- Google Cloud 대신 EC2 또는 Cloudflare에 본 앱을 올려 외부에서 열리는 웹으로 공개하는 방식을 검토한다.
- 공개 전 보안 점검을 한다.

# Done
<!-- 완료 -->
- Cypress 파일, 설정, 의존성을 모두 지우고 GitHub 워크플로(.github)도 전부 삭제했다.
- 패키지 관리를 yarn에서 pnpm으로 바꾸고 Playwright 의존성, 기본 설정, 스모크 테스트 하나를 넣었다.
- README에 라이선스 준수 섹션(영문과 한국어)을 쓰고, 푸터의 Cypress 로고는 출처 텍스트 링크로 바꿨다.
- .env는 git 추적에서 빼고 .env.example을 만들었으며, 환경 설정은 이 두 파일로 나눠서 쓴다.
- 웹 앱과 PostgreSQL을 docker compose로 켜게 했고, 명령은 pnpm docker:up, down, reboot, logs, status 다섯 개다.
- 접속 포트를 웹 7201, API 7202로 통일했고, 바꿀 때는 .env 한 곳만 고치면 된다.
- 왼쪽 사이드바의 Logout 버튼을 맨 아래에 고정했다.
- 테스트용 속성 이름을 data-test에서 data-testid로 통일했다.
- Babel AST로 data-testid를 색인하는 스크립트를 만들었고, pnpm testid:list, check, add, add:write로 쓴다. 결과는 testid-listup.md에 나온다.
- PostgreSQL에 Prisma 마이그레이션으로 테이블 8개를 만들었고, DataGrip으로 접속해서 볼 수 있다.
- .env.example의 기본 정보를 변경했다.
- base repo를 개인 repo로 옮겼고(origin), 원본은 upstream으로 남겼으며, develop에서 main 브랜치를 만들었다.
- 서버를 켤 때마다 바뀌는 data/database.json은 커밋에서 뺀다.

# Drops
<!-- 할 필요 없음 판단된 업무 목록 -->
-

# Licenses
- 원본 Cypress Real World App의 MIT 라이선스 전문(LICENSE)과 Copyright (c) 2020 Cypress.io 저작권 고지를 삭제하거나 수정하지 않고 유지한다.
- 이 저장소는 원본(cypress-io/cypress-realworld-app)의 개인 포크임을 README에 명시하고, Cypress.io와 제휴·보증·후원 관계가 없음을 밝힌다.
- 본 프로젝트는 개인 학습과 포트폴리오라는 비상업적 목적으로만 사용한다.
- Cypress 로고와 상표(Cypress 로고 SVG 등)는 화면과 문서에 노출하지 않으며, 원본 프로젝트를 출처 텍스트 링크로만 표기한다.
- 내가 수정한 부분도 MIT 라이선스 조건에 따라 공유하고, 소프트웨어는 "있는 그대로" 제공되며 무보증임을 전제로 한다.
- 새로 추가하는 서드파티 의존성(Playwright 등)은 각 라이선스를 확인하고 그 조건을 따른다.
- Auth0, Okta, Cognito, Google 등 외부 서비스의 키와 비밀번호는 .env에만 두고 절대 커밋하지 않는다.