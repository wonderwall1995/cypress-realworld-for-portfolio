# Second cycle plan: regression E2E with past fixture values

- Date: 2026-11-23, branch `feat/test-structure`
- Status: final plan. **Nothing in it is built yet.** Building starts only when the owner says so.
- It merges the first plan (Claude) and its review (Codex). You do not need those two files to read this one.
- This repository is public. Do not write secrets, addresses of servers, or passwords here.

## 1. Goal

**Run the same E2E specs again with the input values of an earlier run number.**

| Cycle | What it does | State |
| --- | --- | --- |
| First | One spec for each feature, 000 to 009. Every change ends with a run of all specs. | Done for 000 to 009 |
| Second | The same specs, with the stored values of a past run number. | This plan |

The exact name for the second cycle is **data-driven regression testing with stored past inputs**.

It proves that the current code can still take those inputs. It does not prove more than that (see section 3).

## 2. Who decided what

**Decided by the owner**

- Reuse the test code. Give it a chosen fixture. Do not copy specs into another folder.
- A fixture is a store of input values. A test record is a store of results. Past fixtures are chosen by the date they were created.
- Users and records may pile up on EC2. This is intended.
- The owner pushes and deploys.
- The readers are two groups: HR looks at the web demo, and QA interviewers read the test code.

**Agreed by both plan and review (not yet confirmed by the owner one by one)**

- Make a new user for each replay. Do not delete users.
- Never replace a missing past value with a random value in silence.
- Do not write replay results to the database.
- Keep `TEST_RUN_FIXTURES` as the way to pass values.

**On hold or out of scope**

- Testing past *failures* again.
- Running old commits.
- Comparing Web and App results.
- A generator for every combination of partitions.
- An API that deletes users.
- Logging in as past *users* (section 9).

## 3. Values and people are different

| You bring back | What happens | What it proves |
| --- | --- | --- |
| Past **values** | New users are made from them. The judgements of the specs stay correct ("exactly 5 transactions", "starts with 0 accounts"). | The current code accepts and shows these inputs. |
| Past **people** | Old transactions and settings are still there. Exact judgements break. | Existing data still works in the current code. |

The second cycle uses **values only**. Until section 9 is done, do not say that compatibility with old database data is tested.

## 4. What exists now

| Part | State |
| --- | --- |
| `testschema` tables, run numbers, `/api/testRuns` | Built. Applied to the local development database. Not applied to EC2. |
| `pnpm test:run` (starter, all specs, finisher) | Built. It does not retry, and it does not accept `--reporter`. |
| `runFixtures(label)` in `tests/e2e/fixture/run-fixtures.ts` | Built. It reads `TEST_RUN_FIXTURES`. |
| `GET /api/testRuns/:runNo/fixtures` (secret needed) | Built. It returns stored values and makes no new ones. |
| Specs that use the values of a number | 000 to 009 (since 2026-11-24). Numbers before 8: 003 only. |
| Labels in the server rules (`test-fixture-rules.ts`) | `auth`, `bank-account`, `deposit`, `transfer`, `transaction-detail`, `transaction-filter`, `user-settings`, `transaction-visibility`, `notifications`, `login-logout`. |
| `web_test_record`, `app_test_record`, `web_test_report`, `app_test_report`, view `final_test_report` | Built (they replaced `code_result` on 2026-11-24). `pnpm test:run` stores every test and the tools it called, and one report at the end. The commit of the tests and the versions are stored (guide 3.18). |
| Demo in the browser | Random values. It does not read a run number. |

Two facts to keep in mind:

- `finished` means that the run reached its end. **It does not mean that the run passed.** Do not use it to choose a "successful" number.
- The local numbers 1 to 4 were made with uncommitted code. They are practice numbers.

## 5. Problems to solve first

1. **User names collide.** A name is base + run number + platform mark, and users are never deleted. A second sign-up with the same name fails.
2. **Old numbers lack new values.** A number stores only the labels and items that existed when it was opened.
3. **Some inputs do not come from fixtures.** Amounts, comments, profiles, and passwords are still random in many specs.
4. **Dates follow the clock.** 005 builds date filters from today. The same fixture does not give the same dates.
5. **003 keeps its accounts when it has fixtures.** It cleans up only when `fixtures` is missing. A replay has fixtures and must clean up, so this condition must ask "is this a numbered run?" and not "are there fixtures?".
6. **009 needs letters in the password.** It tests upper and lower case. A fixture password is 24 characters of 0-9 and a-f, so it has no upper-case letters. 009 keeps its own password, and the report says so.

## 6. Steps

Do one step at a time. Run all specs after each step. The owner watches each one.

### Step 1. Connect each spec to the fixtures

| Order | Spec | Work |
| --- | --- | --- |
| 1 | 004, 005 | The labels exist. Pass the label to the tools. Take amounts and the comment from the fixture. |
| 2 | 000 | The label exists. The sign-up on the screen takes the values. |
| 3 | 001, 002 | The labels exist. `goToMain` gets an optional label. |
| 4 | 006, 007, 008, 009 | The labels exist. Connect each spec. |

Rules for this step:

- With no number, a spec uses random values, as now.
- With a number, a missing label or item is a clear error. It is never a random value.
- Boundary values stay in the spec. They are not fixture values.
- A spec reads values only through `runFixtures()`. It does not know where they come from.

### Step 2. Add the replay command

```text
pnpm test:replay <run number>
```

1. A small setup step reads the values of that number from the number server. It opens no number and joins no number.
2. It adds a replay suffix to every user name. The stored fixture does not change. The suffix differs for each replay, so two replays cannot collide.
3. It writes the values to the same file that `pnpm test:run` uses, and the specs run.
4. A spec whose label is not in that number is **skipped with the reason**. It is not counted as replayed.
5. No finisher, no signals, and no retries. Nothing is written to `testschema`.

The suffix makes the user name longer. Where the length or the letters of the name are the subject, the replay is not the same input. The report shows the original name and the name that was used. It never shows a password.

### Step 3. Write a local report

One JSON file for each replay, in a git-ignored folder:

| Item | Why |
| --- | --- |
| Source run number, and the day it was opened | Which past input was used |
| Labels replayed, and labels skipped with the reason | What was really covered |
| User names before and after the suffix | What was changed |
| Commit, and whether there were uncommitted changes | Which code was tested |
| Number server, and tested app (`local` or `EC2`, not the address) | They can be different |
| Result of each spec | Passed, failed, or skipped |

Do not build a larger record system for this.

### Step 4. Choose a number

1. List the numbers with `GET /api/testRuns` and leave out the blocked ones.
2. Narrow them by `created_at`.
3. Look at the stored values, not at the formula. The rules may have changed since that number was opened.

The current formula does not cover all 108 combinations (3 x 3 x 3 x 4). The review counted 36 for numbers 1 to 108. Every pair of user name, name, and phone partitions appears in numbers 1 to 9. This is enough for now.

## 7. Done when

- `pnpm test:replay <n>` runs every spec that the number supports, with no copied spec.
- The same number can be replayed twice in a row, and both runs sign up new users.
- Removing one stored item stops or skips the spec with a clear message. No random value is used.
- A defect put into the code on purpose (for example, refusing a stored phone format) makes the replay fail.
- `testschema` has the same rows before and after a replay.
- Accounts made by a replay are removed. Users and transactions stay.
- `pnpm test`, `pnpm test:run`, and the demo work as before.

Try a replay on the test database first. Do not open new numbers in the development database without the owner's permission.

## 8. Limits to state openly

- A replay does not restore an old database and does not reproduce an old failure.
- Values from EC2 tested on a local app say nothing about the users on EC2.
- Dates, replay suffixes, and the password of 009 are not the past input.
- A replay of a practice number (1 to 4) says little, because its code was not committed.

## 9. Later: looking at past people

Not part of this plan. If the owner wants it, design it on its own.

- It only reads: log in as a past user and look at lists, details, accounts, and settings.
- It runs where that user exists.
- It needs its own judgements. "Visible" does not prove that a long name does not cover the next line.
- Decide first which test data is kept and which is cleaned. The tests now delete their accounts fully, but users and transactions stay, so some transactions point to accounts that are gone.

## 10. Questions for the owner

1. Is `pnpm test:replay <run number>` the right command name?
2. Step 2 skips a spec with a reason when the number has no label for it. Is this right, or must the whole replay stop?
3. Must the demo in the browser show past values too, or only Playwright?
4. When is `testschema` applied to EC2? Until then, only local numbers can be replayed.
