# fixture-prisma-guide

LLM이 다른 LLM에게 넘기는 설계 문서다. Web(Playwright) 쪽에서 User와 합의한 내용을 적는다. 나중에 Flutter App 쪽 테스트를 만드는 LLM이 같은 규칙을 따르도록 하기 위한 문서다.

- 작성: 2026-11-22
- 근거: User와 한 질문, 답 세션 (결정마다 User가 선택했다)
- 이 저장소는 공개 저장소다. 이 문서에 비밀번호, 접속 주소, 키를 쓰지 않는다.

## 0. 이 문서를 읽는 LLM에게

- User와는 한국어로, 짧고 평이한 문장(ASD-STE100 스타일)으로 이야기한다. 저장소 루트의 `LLMS.md` Rules를 먼저 읽는다.
- 결정할 일은 하나씩 묻는다. 선택지를 주고, 추천안을 맨 앞에 둔다. 번호 목록으로 여러 쟁점을 한꺼번에 던지지 않는다.
- 이모지를 쓰지 않는다.
- 아래 "결정"은 User가 고른 것이다. 바꾸려면 먼저 User에게 묻는다.
- "구현 상태"를 확인한다. 아직 없는 서버 API를 있다고 가정하지 않는다.

## 1. 목적

- Web 테스트와 App 테스트가 **같은 실행 번호에서 같은 난수(Fixture)** 를 쓴다. 그래서 두 플랫폼의 결과를 같은 조건에서 비교할 수 있다.
- 모든 테스트 코드의 성공/실패를 DB에 쌓는다. 나중에 Grafana로 실패율을 본다.
- 실행 번호마다 Web과 App이 모두 실행했는지 DB에서 셀 수 있다.

## 2. 용어

| 용어 | 뜻 |
|---|---|
| 실행 번호 (run_no) | Web과 App이 함께 쓰는 하나의 번호 줄. 1, 2, 3... **전체 실행 한 번에 번호 하나**다. 테스트 파일마다 따로 세지 않는다. |
| 플랫폼 | `web` 또는 `app` |
| Fixture | 실행 번호별 난수 값. 서버가 만들고 DB에 저장한다. |
| 이름표 (test_case) | 테스트를 가리키는 짧은 이름. 예: `deposit`. Web과 App이 같은 테스트에 같은 이름표를 쓴다. 파일 이름과는 따로다. |
| Blocked | 무효가 된 번호. 기록은 남지만 통계에서 뺀다. |
| 코드 종류 (kind) | `spec`(테스트 본문), `common`(재사용 업무 동작), `api`(API 검증 도구), `fixture`(테스트에 쓰는 값을 만들거나 받아 오는 코드, 번호와 기록을 다루는 코드) |

## 3. 결정 사항

### 3.1 DB 위치
- PostgreSQL의 별도 스키마 `testschema`에 둔다. 앱 테이블은 `public` 스키마에 있다.
- 앱 DB 초기화(`/api/testData/reset`)는 앱 테이블 이름을 하나씩 적어서 비우므로 `testschema`는 지워지지 않는다.

### 3.2 번호 규칙
- 실행을 시작하면 서버에 "플랫폼 X가 시작한다"고 알린다.
- 서버는 가장 최신 번호를 본다.
  - 그 번호가 `open`이고 X가 아직 그 번호를 실행하지 않았으면, X는 **그 번호에 합류**하고 같은 Fixture를 쓴다.
  - X가 이미 그 번호를 실행했거나 그 번호가 `blocked`이면, 서버가 **새 번호(최신+1)** 와 새 Fixture를 만든다.
- 최신보다 예전 번호는 닫힌다. 다시 돌리지 않는다. (예외: 3.13 리그레션 점검은 예전 번호의 값을 읽기만 한다)
- 예: Web이 217까지 했고 App이 218, 219를 했다. Web의 다음 실행은 218이 아니라 219다.
- 두 플랫폼이 거의 같은 순간에 "새 번호가 필요하다"고 판단해도 새 번호는 하나만 생긴다(서버 잠금 + DB 고유 조건). 늦은 쪽은 그 번호에 합류한다.

### 3.3 동시 시작 (2026-11-23 변경)
- Web과 App이 같은 번호를 동시에 시작하면 **기다리지 않고 같이 돈다.** 같은 번호, 같은 값이고 유저만 다르다(217w와 217a, 3.14).
- 전에는 나중 쪽이 기다리기로 했다. 같은 유저를 함께 쓴다고 보았기 때문이다. DB의 `waiting` 상태 값은 없앴다(2026-11-24).

### 3.4 완료와 Blocked
- 실행이 끝까지 돌면 그 플랫폼은 그 번호를 "했다"(`finished`). 각 테스트의 성공/실패는 그대로 기록한다. 실패도 정상적인 결과다.
- 어느 한 플랫폼이라도 **중간에 멈추면 그 번호 전체가 Blocked**다. 다른 플랫폼이 이미 끝까지 돌았어도 마찬가지다. 기록은 남기고 통계에서 뺀다.
- "중단"이라는 상태를 따로 두지 않는다. Blocked 하나로 처리한다.
- 멈춤은 두 가지로 알아낸다.
  - 테스트 도구가 멈춤을 알 수 있으면(예: Ctrl+C) 그 자리에서 Blocked를 보낸다.
  - 프로세스가 신호 없이 죽으면, **마지막 신호 뒤 10분**이 지났을 때 서버가 Blocked로 바꾼다.
- 그래서 실행 중에는 신호를 계속 보내야 한다. **테스트 하나가 끝날 때마다 결과를 보내면 그것이 신호가 된다.** App은 테스트를 차례대로 돌려서 실행이 길어지므로 이 점이 특히 중요하다.

### 3.5 기록 실패
- 실행 도중 결과를 서버에 보내지 못해도 테스트는 계속한다.
- 못 보낸 기록은 로컬 파일에 잠시 모아 두고, 실행이 끝날 때 다시 보낸다.
- 그래도 못 보내면 그 번호는 Blocked가 된다(기록이 빠진 결과는 믿을 수 없다).
- 시작할 때 번호와 Fixture를 받지 못하면 테스트를 시작하지 않는다.

### 3.6 일부 실행
- 전체가 아니라 일부 테스트만 돌리는 실행(예: 입금 테스트 하나)은 **번호를 받지 않고, DB에 올리지 않고, 통계에 넣지 않는다.**
- 이것은 개별 테스트 코드의 점검이다. 성공/실패는 로컬 로그로만 남긴다.

### 3.7 Fixture
- 서버(API)가 한곳에서 만든다. 클라이언트(Playwright, Wdio)는 난수를 만들지 않고 받아서 쓴다. 그래서 난수 규칙이 서버 한 곳에만 있다.
- **번호마다 한 줄(시험의 금액과 댓글)과 사람 세 줄(A, B, C)** 로 저장한다. 값은 칸이다. (2026-11-24 변경. 전에는 번호 / 이름표 / 항목마다 한 줄이었고, 번호 하나가 217줄이었다)
  - Web과 App은 같은 값을 받는다.
  - 한 번호의 모든 시험이 같은 A, B, C를 쓴다. 시험마다 다른 것은 아이디뿐이다(3.14). 그래서 병렬로 돌아도 서로 부딪히지 않는다.
  - 시험이 부르는 이름(이름표와 항목, 예: `transfer`의 `A.firstName`)과 서버의 답은 전과 같다.
- 사람만 필요한 새 시험은 DB를 바꾸지 않는다. 새 금액이나 글이 필요하면 `test_fixture`에 칸을 더한다(마이그레이션).
- 만드는 규칙은 서버의 목록 하나에 둔다(이름표별 항목과 규칙). 이 목록이 Web과 App 사이의 약속이다. 새 테스트를 만들 때 필요한 항목을 이 목록에 더한다(User가 고른 "필요할 때 더하는" 방식).
- 이미 열린 번호에 없는 항목을 요청하면, 서버가 그때 만들어 저장한다. 뒤에 오는 플랫폼도 같은 값을 받는다.
- Web과 App 모두 000~009에서 사람의 값을 번호에서 받고, 금액과 댓글은 003, 004, 005만 받는다(2026-11-24). 나머지 금액과 001, 002의 계좌 값은 각자의 난수다. 009는 비밀번호와 계좌 값을 스스로 만든다.
- 목록에 없는 항목을 요청하면 서버는 분명한 오류를 낸다.

### 3.8 테스트 독립
- 테스트끼리는 **값만 공유하고 데이터는 독립**이다. 각 테스트는 Fixture에서 자기 몫의 값을 꺼내 자기 데이터(계정, 계좌)를 스스로 만든다. 다른 테스트가 만든 데이터를 이어서 쓰지 않는다.
- 각 테스트는 시작과 끝에 자기 은행 계좌를 지운다. **유저와 거래는 남는다** (유저를 지우는 기능이 없다. 2026-11-23 확인). Web의 하드 삭제 API는 로그인한 사용자 자기 계좌만 지운다. 예외: Web의 정식 실행에서 003은 A, B, C의 계좌도 남긴다(3.13).
- Web은 병렬로, App은 차례대로(1 -> 2 -> 3) 돌린다(Web의 병렬은 아직 하지 않는다. 지금은 workers 1로 차례대로 돈다). 테스트가 독립이므로 순서가 달라도 결과를 이름표로 비교할 수 있다.

### 3.9 실행 환경
- Web 정식 실행은 당분간 **Chrome 하나**로 한다(firefox, mobile-chrome은 쓰지 않는다). Chrome 안에서는 병렬로 하기로 했으나 지금은 차례대로 돈다.
- 정식 실행은 재시도하지 않는다. 아이디가 번호에 묶여 있어 같은 아이디로 두 번 가입할 수 없다. 기록기를 바꾸는 옵션(`--reporter`)도 받지 않는다.
- 웹 하단의 시연 플레이어는 병렬이 아니라 차례대로 보여 준다.

### 3.10 공개 웹 (EC2)
- 시연 플레이어는 **최신 번호의 Fixture를 읽기만** 한다(화면에 "217번 Fixture"처럼 보인다). 번호를 올리거나 결과를 기록하지 않는다. (아직 만들지 않았다. 지금 시연은 무작위 값을 쓴다)
- 번호와 값은 **EC2 서버의 testschema 한 곳**에만 둔다. Web과 App의 테스트가 같은 서버를 쓴다. 내 PC에서 Playwright를 돌려도 번호와 값은 EC2에 묻고, 시험하는 앱만 내 PC의 것을 쓴다. (2026-11-23 결정)
- 번호를 열고 결과를 기록하는 쓰기 API는 **비밀 값이 있는 요청에만** 연다. 비밀 값을 설정하지 않은 서버에서는 닫혀 있다. (2026-11-23 변경. 전에는 "공개 웹에서 닫는다"였다. App이 EC2를 보므로 닫으면 App 테스트가 번호를 열 수 없다)
- 비밀 값은 테스트를 돌리는 쪽(Playwright, App 테스트 도구)의 환경 설정에만 둔다. 웹 화면 코드, 시연, 앱 설치 파일, 이 저장소에는 넣지 않는다.
- EC2에 닿지 않으면 정식 실행을 시작하지 않는다. 일부 실행(3.6)은 할 수 있다.

### 3.11 기록 방식
- Web: Playwright에 원래 있는 Reporter 기능을 쓴다(외부 서비스가 아니다). 공통/API/fixture 함수는 이름 붙은 단계(`test.step`)로 감싸고, Reporter가 단계의 시작, 끝, 성공/실패, 걸린 시간을 서버에 보낸다.
- App: 테스트 도구는 Appium + Wdio다 (2026-11-23 확인. 앱은 Flutter지만 테스트는 앱 밖에서 TypeScript로 돈다). 같은 역할의 기록기를 Wdio에 둔다. 같은 서버 API를 쓰고, 같은 이름표와 같은 종류(kind) 값을 쓴다.

### 3.12 Web 쪽 파일 배치
- 기존 spec 파일 이름(`000-auth.spec.ts` 등)은 바꾸지 않는다. 이름표는 파일 이름에서 얻는다(`002-deposit.spec.ts` -> `deposit`).
- `tests/e2e/fixture/`: 테스트에 쓰는 값을 만드는 코드와, 번호, Fixture, 기록을 다루는 클라이언트 코드. 무작위 값 도구(`random.ts` 등)와, 정식 실행에서 번호의 값을 꺼내는 `run-fixtures.ts`가 있다. Fixture를 연결한 spec은 정식 실행에서 무작위 값 대신 서버의 값을 쓴다.
- `tests/e2e/starter.spec.ts`: 맨 먼저 한 번 도는 준비 테스트(Playwright setup project). 번호를 열거나 합류하고 Fixture를 받는다. DB 기능이 맞게 동작하는지도 함께 점검한다. starter가 실패하면 나머지 테스트는 돌지 않는다.
- `tests/e2e/finisher.spec.ts`: 맨 끝에 한 번 돈다. 결과를 모두 한 번 더 보낸 뒤 finish를 보낸다. starter가 끝까지 가지 못했거나 저장하지 못한 결과가 있으면 block을 보낸다.

### 3.13 리그레션 점검 (2026-11-23, 보류)
- **보류다.** 지난 유저로 로그인해서 보는 시험은 한 번 006에 넣었다가 떼어 냈다. 지금의 006은 새 유저만 시험한다.
- 다음에 하기로 한 것(2행정): 같은 spec에 **지난 번호의 값**을 주어 다시 돌린다. 지난 코드를 다른 폴더에 두고 돌리지 않는다. 형식은 아직 정하지 않았다.
- 남아 있는 것: Web의 정식 실행에서 003은 A, B, C의 계좌와 거래를 지우지 않는다. App의 003은 정식 실행에서도 계좌를 지운다(리그레션이 보류라서. 맞출지는 리그레션을 할 때 정한다). 유저는 번호로 가리킬 수 있다(A239는 239번의 A).
- 값은 testschema에, 가입한 유저는 앱의 users 테이블에 있다. 그래서 지난 유저가 필요하면 그 유저가 가입한 서버에서 돌려야 한다.

### 3.14 값의 구간 (동치분할, 2026-11-23 결정)
- 값은 무작위로 두고, **구간은 실행 번호와 사람(A, B, C)으로 정해진다.** 번호만 알면 누가 어느 구간이었는지 안다.
- 엇갈려 돈다. 번호를 n(1번은 0), 사람을 p(A 0, B 1, C 2), a = n % 3, b = (n / 3의 몫) % 3 이라 하면
  아이디 (a + p) % 3, 이름 (a + b + p) % 3, 전화번호 (a + 2b + p) % 3, 계좌 번호 자릿수 (n + p) % 4.
- 세 구간짜리 값은 실행마다 A, B, C에게서 모두 나온다. 화면에 나오는 A는 1번부터 돌면 4번(중간부터면 5번) 만에 모든 구간을, 1번부터 9번이면 아이디, 이름, 전화번호의 모든 짝을 만난다 (계산으로 확인).
- 구간을 사람에 고정하지 않는다. 화면에는 A만 나오므로, 고정하면 A가 만나지 못하는 구간이 생긴다.
- 구간 목록:
  - 이름(성, 이름): 한 글자 / 보통(2~6글자) / 긴 이름(20~30글자). 한글과 영문은 구간 안에서 무작위.
  - 아이디의 앞부분: 한글 / 영문과 숫자 / 한글, 영문, 숫자 섞임. 사람마다 달라야 하므로 한 글자 구간은 두지 않는다.
  - 전화번호: 010-1234-5678 / +82 10-1234-5678 / (02) 123-4567 꼴.
  - 계좌 번호: 9 / 10 / 11 / 12자리.
- 아이디 = 앞부분(구간) + 시험 코드 두 자리 + 실행 번호 + 플랫폼 표시(Web은 w, App은 a). 예: 004의 A는 가나다라04217w. 003(`transfer`)만 코드가 없다: 가나다라217w. 같은 번호에서 Web과 App의 유저는 아이디의 마지막 글자만 다르고 나머지 값은 같다.
  - 이렇게 나누는 이유: 같은 아이디로 두 번 가입할 수 없고, 같은 유저를 함께 쓰면 거래 개수 같은 판정이 깨진다.
  - 한 플랫폼은 한 번호를 한 번만 돌므로 겹치지 않는다. 정식 실행은 재시도하지 않는다(3.9).
  - 시험 코드는 서버의 규칙 목록(`test-fixture-rules.ts`)에 있다. 같은 번호의 004와 005의 A가 겹치지 않게 한다. 바꾸거나 다시 쓰지 않는다. (2026-11-24 변경. 전에는 앞부분을 이름표마다 다르게 만들었다)
  - 코드는 번호 앞에 둔다. 화면의 찾기는 아이디의 일부도 찾으므로, 003의 A(`x6w`)를 찾을 때 004의 A(`x046w`)가 나오면 안 된다.
  - 003에 코드가 없는 것은 코드가 없던 때의 003 유저를 계속 찾기 위해서였다. 그때의 번호(1~8)는 2026-11-24에 지웠다. 그래도 바꾸지 않는다(두 플랫폼이 같은 규칙을 쓴다).
- 구간만으로는 화면 문제를 잡지 못한다. 예: 긴 이름이면 거래 목록의 좋아요 줄이 다음 줄에 가려졌다(2026-11-23 확인, 2026-11-24 고침). 가려졌는지 보는 판정은 아직 없다.

### 3.15 서버 API (2026-11-23)
주소는 모두 `/api/testRuns` 아래다. `latest` 말고는 머리말 `Authorization: Bearer <비밀 값>`이 필요하다.

| 요청 | 하는 일 |
|---|---|
| POST / { platform, device?, code? } | 번호를 열거나(201) 합류하고(200) 값과 버전(`versions`)을 받는다. `code`는 3.18 |
| POST /:runNo/signal, finish, block { platform } | 살아 있음, 끝까지 돌았음, 중간에 멈춤. 답에 `finalResult`가 있다 |
| POST /:runNo/results | 시험 하나의 결과를 저장한다 (3.17) |
| GET /:runNo/results | 그 번호에 저장된 결과 전부 |
| GET / | 번호, 날짜, 상태 목록 (리그레션이 고를 때) |
| GET /:runNo/fixtures?platform=web | 그 번호의 값 전부. 새 값을 만들지 않는다 |
| GET /latest | 누구나. 최신 번호의 값에서 아이디와 비밀번호를 뺀 것 |

- 비밀 값은 서버의 `TEST_RUN_SECRET` (32자 이상). 없으면 보호된 주소는 404, 틀리면 401이다.
- **비밀번호는 DB에 저장하지 않는다.** 시연의 DB 탭이 모든 테이블을 보여 주기 때문이다. 비밀 값, 번호, 이름표, 사람으로 계산한다. 비밀 값을 바꾸면 지난 유저로 로그인할 수 없다.
- 번호는 "가장 큰 번호 + 1"이다. 자동 증가는 실패한 요청에도 번호를 건너뛴다.
- 10분 규칙은 다음 요청이 왔을 때 적용한다.

### 3.16 과거 이력을 쓰는 법 (2026-11-23, 보류)
- 픽스처(test_fixture, test_fixture_person)는 **입력 값의 저장소**이고, 기록(web_test_record, app_test_record)은 그 값으로 돈 **결과의 기록**, 보고(web_test_report, app_test_report)는 **완료된 상태**다.
- `finished`는 끝까지 돌았다는 뜻이다. **통과했다는 뜻이 아니다.** 통과했는지는 보고의 `result`를 본다.
- 로컬의 옛 번호 1~8은 2026-11-24에 지웠다. 번호는 다시 1부터다.
- 과거에 실패한 시험을 다시 돌리는 것(재시험)은 보류다. 방법과 횟수를 정하지 않았다.
- 기록은 고치지 않고 쌓기만 한다. EC2에 유저와 기록이 쌓이는 것은 의도다.
- Web과 App의 결과 비교는 당장의 목표가 아니다. 서버 API는 둘 다 쓸 수 있게 둔다.

### 3.17 결과 기록 (2026-11-24)
시험 하나가 끝날 때마다 그 시험과, 그 시험이 부른 도구들의 결과를 한 번에 보낸다. 이것이 신호를 겸한다(3.4).

```json
POST /api/testRuns/5/results
{
  "platform": "app",
  "testCase": "deposit",
  "name": "2. 입금: ...",
  "file": "002-deposit.spec.ts",
  "attempt": 1,
  "status": "failed",
  "startedAt": "2026-11-24T01:00:00.000Z",
  "durationMs": 19740,
  "errorMessage": "Error: expect(received).toEqual(expected)",
  "steps": [
    { "kind": "common", "name": "signIn", "file": "signin.ts", "status": "passed",
      "startedAt": "2026-11-24T01:00:00.500Z", "durationMs": 5759 }
  ]
}
```

| 칸 | 규칙 |
|---|---|
| testCase | 이름표. 소문자, 숫자, `-`, 50자까지. Fixture 규칙 목록에 없는 앱 전용 이름표도 받는다 |
| name, file | 1~200자 |
| attempt | 1부터. 없으면 1 |
| status | `passed` / `failed` / `skipped`. 시간 초과는 `failed`로 보낸다 |
| startedAt, durationMs | ISO 시각(밀리초까지), 0 이상의 정수 |
| errorMessage | 있어도 되고 없어도 된다. 실패일 때만 저장한다 |
| steps | 도구들. 300개까지. kind는 `common` / `api` / `fixture` |

| 답 | 뜻 |
|---|---|
| 201 `{ "stored": 3 }` | 저장했다 (시험 1줄 + 도구 줄 수) |
| 200 `{ "stored": 0 }` | 전에 저장한 결과다. **다시 보내도 안전하다** |
| 404 / 409 | 시작하지 않은 실행 / 이미 끝났거나 막힌 실행 |
| 422 / 401 | 형식이 틀림 / 비밀 값이 틀림 |

- 플랫폼에 따라 web_test_record 또는 app_test_record에 저장한다.
- **같은 결과의 기준:** 번호, 플랫폼, 이름표, 이름, 시도, 시작 시각이 모두 같으면 같은 결과다. 다시 보낼 때 시작 시각을 바꾸지 않는다.
- **먼저 파일에 적고 보낸다.** 끝나기 직전에 파일의 것을 모두 한 번 더 보내고, 하나라도 저장되지 않으면 finish 대신 block을 보낸다(3.5). 끝난 뒤에는 새 결과를 받지 않는다.
- 도구가 도구를 부르면 모두 그 시험의 자식으로 저장한다. 도구끼리의 관계는 저장하지 않는다.
- **오류는 첫 줄만, 300자까지 저장한다.** DB 탭이 모든 테이블을 보여 주기 때문이다. 서버가 자르지만, 보내는 쪽도 비밀번호를 첫 줄에 넣지 않는다.
- starter와 finisher, 사람이 멈춰서 끊긴 시험은 기록하지 않는다.
- 어느 코드로 돌았는지는 3.18에 따라 저장한다.

### 3.18 버전 (2026-11-24, 같은 날 수동으로 변경)
- 서버, Web 화면, App 빌드가 각각 자기 버전을 가진다. 모양은 `앞.뒤`다 (예: `0.100`, 다음 `0.101`. 앞에 0을 붙이지 않는다).
- **버전은 사람(User)이 적는다.** 자동으로 오르지 않는다.
  - 서버: `apps/api/VERSION`. 고친 뒤 서버를 다시 켠다(켜질 때 한 번 읽는다).
  - Web 화면: `apps/web/VERSION`. starter가 읽는다.
  - App: 앱 저장소에서 정하고 `code.targetVersion`으로 보낸다.
- **소스 파일의 지문**은 계속 계산해 버전과 함께 저장한다. 버전을 적는 파일은 지문에 들어가지 않는다. 문서와 시험 코드, 줄 끝의 차이도 들어가지 않는다.
  - 서버: `apps/api`의 소스와 prisma, `packages/shared/src`. 서버가 켜질 때 한 번 계산한다.
  - Web 화면: `apps/web`의 소스와 `packages/shared/src`. starter가 계산한다.
  - App: `pnpm build`가 앱 소스로 계산한다.
- 번호를 열 때 `code`를 보낸다. 모두 없어도 된다.

| 칸 | 뜻 |
|---|---|
| `code.testCommit`, `code.testDirty` | 시험 코드의 커밋, 커밋하지 않은 변경이 있는지 |
| `code.target` | Web 화면 또는 App의 지문 (16자리 16진수) |
| `code.targetVersion` | Web 화면 또는 App의 버전. 글자다 (예: `"0.101"`). 모양이 틀리면 422 |

- 번호를 열 때의 답과 finish, block의 답에 `warnings`가 있다(없으면 빈 목록). **경고가 있어도 막지 않는다.** finish와 block에는 서버의 경고만 있다.

```json
"versions": { "server": "0.100", "target": "0.100" },
"warnings": [
  { "part": "app", "code": "code_changed", "sent": "0.100", "used": "0.100",
    "message": "the code changed but the version was not raised" }
]
```

| code | 뜻 | 저장하는 버전 (`used`) |
|---|---|---|
| `code_changed` | 버전은 같은데 지문이 다르다 | 보낸 버전. 그 버전의 첫 지문은 그대로 둔다 |
| `version_changed` | 지문은 같은데 버전이 다르다 (앞자리가 같을 때) | 예전 버전 |
| `version_missing` | 지문만 있고 버전이 없다 | 그 지문의 예전 버전. 모르면 빈칸 |
| `fingerprint_missing` | 버전만 있고 지문이 없다 | 보낸 버전. `test_version`에는 저장하지 않는다 |

- `part`는 `server` / `web` / `app`. `message`는 사람이 읽는 글이라 바뀔 수 있다. 판단은 `code`로 한다.
- 서버 버전은 시작과 끝에 저장한다.
- `final_test_report.same_server`: Web과 App의 시작과 끝, 네 번의 서버 버전이 모두 같으면 true. **버전을 사람이 적으므로, 서버 코드를 고치고 버전을 올리지 않으면 코드가 달라도 true가 된다.** 그때는 경고(`code_changed`)만 나온다. 번호에는 지문을 저장하지 않으므로 나중에 알 수 없다.
- 버전이 다르다는 것은 알려 주지만, 결과가 달라진 원인은 알려 주지 않는다.

## 4. 테이블 (testschema) (2026-11-24 다시 만듦)

Prisma 설계 파일: `apps/api/prisma/schema.prisma`. 지금 모양을 만든 DB 변경 파일: `apps/api/prisma/migrations/20261124010000_fixture_parent_and_reports/migration.sql`.

```
test_fixture (번호마다 1줄, 모두의 상위)
 ├─ test_fixture_person   번호마다 3줄 (A, B, C)
 ├─ run_progress          번호 + 플랫폼마다 1줄 (내부용, 버전)
 ├─ web_test_record       기록. 시험과 도구마다 1줄
 ├─ app_test_record       같은 모양
 ├─ web_test_report       완료 보고. 번호마다 1줄
 └─ app_test_report       같은 모양
test_version              버전마다 1줄 (3.18)
final_test_report (뷰)     두 보고, 최종 결과, 버전을 번호마다 1줄로 보여 준다
```

`test_run`, `platform_run`, `code_result`는 없다. 이름표와 항목을 줄로 쌓던 옛 `test_fixture`도 없다.

### test_fixture: 번호와 시험의 값
| 칸 | 형 | 뜻 |
|---|---|---|
| run_no | int, PK | 실행 번호 (가장 큰 번호 + 1) |
| opened_by | `web` / `app` | 이 번호를 처음 연 쪽 |
| created_at | timestamp | 연 시각 |
| transfer_cycle_dollars | int | 003의 금액 |
| detail_dollars, detail_comment | int, text | 004의 금액과 댓글 |
| filter_sent_small_dollars, filter_sent_big_dollars, filter_got_small_dollars, filter_got_big_dollars | int | 005의 금액 |

값의 칸은 빈칸일 수 있다(번호보다 나중에 생긴 칸). 열린 번호에 합류할 때 서버가 채운다.

### test_fixture_person: 사람의 값
| 칸 | 형 | 뜻 |
|---|---|---|
| run_no, person | int FK, `A`/`B`/`C`, 함께 PK | |
| username_base | text | 아이디의 앞부분. 서버가 시험 코드, 번호, 플랫폼 표시를 붙인다(3.14) |
| first_name, last_name, phone_number, bank_name, account_number | text | |
| partition_username, partition_name, partition_phone, partition_account_length | text, 마지막만 int | 구간(3.14) |

### run_progress: 진행 (내부용)
| 칸 | 형 | 뜻 |
|---|---|---|
| run_no, platform | int FK, `web`/`app`, 함께 PK | 한 플랫폼은 한 번호를 한 번만 돈다 |
| status | `running` / `finished` / `blocked` | |
| device | text, 빈칸 가능 | 예: `chrome` |
| started_at, last_signal_at, finished_at | timestamp | 10분 규칙에 쓴다 |
| server_version, server_version_end | text, 빈칸 가능 | 시작과 끝의 서버 버전 |
| target_version | text, 빈칸 가능 | Web 화면 또는 App 빌드의 버전 |
| test_commit, test_dirty | text, boolean, 빈칸 가능 | 시험 코드의 커밋, 커밋하지 않은 변경이 있었는지 |

번호의 상태(`open` / `blocked`)는 저장하지 않는다. 한 플랫폼이라도 blocked이면 그 번호가 blocked다.

### test_version: 버전
| 칸 | 형 | 뜻 |
|---|---|---|
| part, version | `server`/`web`/`app`, text, 함께 PK | 예: `server` 0.100 |
| major, minor | int | 0, 100 |
| fingerprint | text | 소스 파일의 지문 16자. (part, major, fingerprint)는 고유하다 |
| first_seen_at | timestamp | 처음 돈 때 |

### web_test_record, app_test_record: 기록
| 칸 | 형 | 뜻 |
|---|---|---|
| id | serial, PK | 테이블마다 따로 센다 |
| run_no | int, FK -> test_fixture | |
| kind | `spec` / `common` / `api` / `fixture` | |
| test_case | text | 이름표 |
| name | text | 테스트 제목 또는 함수 이름 (예: `createBankAccount`) |
| file | text | 파일 이름 |
| parent_id | int, 같은 테이블 FK, 빈칸 가능 | 이 코드를 부른 spec 줄. spec 자체는 빈칸 |
| status | `passed` / `failed` / `skipped` | |
| attempt | int, 기본 1 | 재시도 번호 |
| error_message | text, 빈칸 가능 | |
| started_at, duration_ms | timestamp, int | |

색인: (run_no, kind), (test_case).

### web_test_report, app_test_report: 완료 보고
| 칸 | 형 | 뜻 |
|---|---|---|
| run_no | int, PK, FK -> test_fixture | |
| spec_ok, common_ok, api_ok | boolean, 빈칸 가능 | 그 종류가 모두 성공 / 하나라도 실패. 빈칸은 돌지 않았거나 Blocked. **spec_ok는 돌아야 할 시험이 빠졌거나 건너뛰었으면 false다**(아래) |
| result | `passed` / `failed` / `blocked` | 그 플랫폼의 결과 |
| reported_at | timestamp | |

- 끝(finish, block, 10분 규칙)에 한 번 쓴다. 줄이 없으면 아직 끝나지 않은 것이다.
- `passed`는 spec이 하나 이상 돌아 모두 성공했고, common과 api에 실패가 없다는 뜻이다. 시험이 통과했어도 도구가 하나라도 실패했으면 `failed`다.
- 재시도한 시험은 마지막 시도만 센다. `skipped`는 세지 않는다. `fixture` 종류는 칸이 없다(기록에는 남는다).

### final_test_report: 최종 결과 (뷰)
- 칸: run_no, created_at, web_spec_ok, web_common_ok, web_api_ok, web_result, app_(같음), final_result, decided_at, same_server, 그리고 web_과 app_의 version, server_version, server_version_end, test_commit, test_dirty.
- 돌아야 할 시험은 서버의 이름표 목록(`FIXTURE_RULES`) 전부다. 두 플랫폼에 같이 적용한다. 목록에 이름표를 더하면 **두 쪽 모두** 그 시험이 있어야 `passed`가 된다. 목록에 없는 시험(한쪽에만 있는 것)은 있어도 되고 없어도 되지만, 실패하면 실패다. (2026-11-24, 그 전의 보고는 그대로다)
- `final_result`: 한쪽이라도 멈췄으면 `blocked`, 한쪽이 끝나지 않았으면 `pending`, 둘 다 `passed`면 `passed`, 아니면 `failed`.
- 뷰라서 두 보고와 어긋날 수 없다. Prisma 설계 파일에는 없고, DB 탭에도 나오지 않는다.
- 보고 테이블과 run_progress의 칸을 바꾸는 마이그레이션은 이 뷰를 먼저 지우고 다시 만들어야 한다.
- 한쪽만 돈 번호는 새 번호가 열리면 닫히므로 `pending`으로 남는다. 통계에서 `blocked`와 `pending`을 뺀다.

## 5. 구현 상태 (2026-11-24)

| 항목 | 상태 |
|---|---|
| testschema 테이블 8개와 뷰 1개 (2026-11-24 다시 만듦) | 만듦. 로컬 개발 DB에 적용함 |
| EC2 서버 DB에 적용 | 안 함 |
| 서버 API (3.15) | 만듦. app.ts는 Prisma client가 TestFixturePerson을 알 때만 연결한다. 옛 client로 도는 서버는 404로 답한다 (prisma generate 뒤 다시 켜야 한다) |
| Fixture 규칙 목록 (서버) | `apps/api/src/test-fixture-rules.ts`. 이름표는 auth, bank-account, deposit, transfer, transaction-detail, transaction-filter, user-settings, transaction-visibility, notifications, login-logout |
| `starter.spec.ts`, `finisher.spec.ts`, 기록기(`tests/test-run-reporter.ts`) | 만듦. 기록기는 결과와 멈춤을 보낸다 |
| Chrome 하나로 정식 실행 (`pnpm test:run`) | 만듦. 전체 실행만 받는다 |
| Web spec을 Fixture에 연결 | 000~009 모두 함 (2026-11-24) |
| 버전 기록 (3.18) | 만듦 (2026-11-24). Web은 번호 7부터 |
| 결과 기록(웹, 앱 따로), 완료 보고, 최종 결과 뷰, 못 보낸 기록의 재전송(3.5, 3.17) | 만듦 (2026-11-24). EC2에는 배포해야 한다 |
| 시연이 최신 번호의 값을 읽기(3.10) | 안 함 |
| App(Flutter) 쪽 기록기와 테스트 | 모바일 저장소에 있다. 000~009, `pnpm test:run`, 결과 기록까지 (모바일 커밋 8e75d14. 모바일 세션의 보고) |

서버 API의 주소와 요청 형식은 3.15에 있다. App 쪽 LLM은 이 문서를 근거로 API를 추측해서 만들지 말고, 저장소의 현재 코드(`apps/api/src`)를 확인하거나 User에게 묻는다.

## 6. App(Flutter) 쪽이 지켜야 할 것

- 실행을 시작할 때 서버에서 번호와 Fixture를 받는다. 테스트 코드 안에서 난수를 만들지 않는다.
- Web과 같은 테스트에는 같은 이름표를 쓴다. 이름표 목록은 서버의 Fixture 규칙 목록과 같다. 앱에만 있는 테스트는 자기 이름표를 쓸 수 있다(값은 없고 결과만 기록한다).
- 테스트는 차례대로 돌리되, 각 테스트는 자기 데이터를 스스로 만들고 지운다(독립).
- 테스트 하나가 끝날 때마다 결과를 보낸다(신호를 겸한다). 10분 넘게 신호가 없으면 번호가 Blocked가 된다.
- 결과의 kind 값은 `spec` / `common` / `api` / `fixture` 넷 중 하나다. App 코드도 이 네 종류에 맞춰 나눈다.
- 일부 테스트만 돌릴 때는 번호를 받지 않고 결과를 DB에 올리지 않는다.
- 중간에 멈추면 그 번호는 Web 결과까지 포함해 Blocked가 된다. 사람이 멈출 때는 가능하면 Blocked 신호를 보내고 끝낸다.

## 7. 남은 결정

- 2행정(지난 번호의 값으로 다시 돌리기)에서 아이디가 겹치지 않게 하는 방법
- 시험 대상 환경(내 PC, EC2)을 어떻게 적을지
- EC2의 번호를 쓰면서 내 PC의 앱을 시험하면 지난 유저가 내 PC에 없다. 정식 실행의 앱도 EC2로 할지
- LLMS.md의 독립 규칙과 리그레션(지난 실행에 기댄다)의 관계
- 비밀번호의 구간 (지금은 숫자 4자리 하나). 화면은 4자 이상을 요구하지만 서버는 길이를 검사하지 않는다.
- Grafana 접속 계정 (읽기 전용 DB 사용자)
- Fixture 규칙이 바뀌었을 때 지난 번호의 값을 어떻게 다룰지 (예: 규칙 버전 칸)
- EC2 서버 DB에 적용하는 시점
