# Second cycle plan: regression E2E with past fixture values

- Written 2026-11-23, rewritten 2026-11-24 for the new tables and the connected specs. Branch `feat/test-structure`.
- Status: step 1 is done. **Steps 2 to 4 are not built.** Building starts only when the owner says so.
- The rules of run numbers, fixtures, records and versions are in `docs/fixture-prisma-guide.md`. This file does not repeat them.
- This repository is public. Do not write secrets, addresses of servers, or passwords here.

## 1. Goal

**Run the same E2E specs again with the input values of an earlier run number.**

| Cycle | What it does | State |
| --- | --- | --- |
| First | One spec for each feature, 000 to 009. Every change ends with a run of all specs. | Done for 000 to 009 |
| Second | The same specs, with the stored values of a past run number. | Step 1 of 4 done |

The exact name for the second cycle is **data-driven regression testing with stored past inputs**.

It proves that the current code can still take those inputs. It does not prove more than that (see section 3).

## 2. Who decided what

**Decided by the owner**

- Reuse the test code. Give it a chosen fixture. Do not copy specs into another folder.
- A fixture is a store of input values. A test record is a store of results. Past fixtures are chosen by the date they were created.
- Users and records may pile up on EC2. This is intended.
- A run that left out a test has not passed (2026-11-24, built).
- The owner pushes and deploys, and changes the version numbers.
- The readers are two groups: HR looks at the web demo, and QA interviewers read the test code.

**Agreed by plan and review, not yet confirmed by the owner one by one**

- Make a new user for each replay. Do not delete users.
- Never replace a missing past value with a random value in silence.
- Keep the results of a replay apart from the records of the numbered runs (section 10, question 2).
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

## 4. What exists now (2026-11-24)

| Part | State |
| --- | --- |
| Values | `test_fixture` (one row for a number: amounts and one comment) and `test_fixture_person` (A, B, C). Every test of a number uses the same three people; the user name carries a code for the test. |
| `GET /api/testRuns/:runNo/fixtures` (secret needed) | Returns the values by label. It makes no new values. **It returns every label for every number, also labels that the number never used** (section 5, problem 2). |
| Specs | 000 to 009 use the values of a number (`runFixtures`, `runUser`, since commit `ba7cd70`). Without a number they use random values. |
| Records and reports | `web_test_record`, `app_test_record`, `web_test_report`, `app_test_report`, view `final_test_report`. A report is `passed` only when every label of the server rules ran and passed. |
| Versions | `run_progress` keeps the commit of the tests, whether they had uncommitted changes, and the versions of the server and the screens. |
| Demo in the browser | Random values. It does not read a run number. |
| EC2 | Nothing of this is applied there. |

## 5. Problems to solve

1. **User names collide.** A name is base + test code + run number + platform mark, and users are never deleted. A second sign-up with the same name fails.
2. **The server cannot tell which values a number really used.** The people are stored once for a number, so every label seems to have values, also labels that were added after the number. The records do not answer it either: a spec that ignored the values leaves the same record. **The commit of the tests does:** a number can be replayed when its tests had no uncommitted changes and its commit contains `ba7cd70`, which connected all specs. The local numbers 1 to 8 of before 2026-11-24 were deleted, so numbering starts at 1 again and no number from before that commit exists.
3. **Dates follow the clock.** 005 builds date filters from today. The same fixture does not give the same dates.
4. **003 keeps its accounts when it has fixtures.** It cleans up only when `fixtures` is missing. A replay has fixtures and must clean up, so this condition must ask "is this a numbered run?" and not "are there fixtures?".
5. **Not every input is stored.** Only 003, 004 and 005 take amounts and the comment from the number. 006 changes a profile to random values, 009 makes its own password and accounts, and the other amounts and texts are random. The report must say so.

## 6. Steps

Do one step at a time. Run all specs after each step. The owner watches each one.

### Step 1. Connect each spec to the fixtures: done

000 to 009 are connected. The rules stay:

- With no number, a spec uses random values.
- With a number, a missing label or item is a clear error. It is never a random value.
- Boundary values stay in the spec. They are not fixture values.
- A spec does not know where the values come from.

### Step 2. Add the replay command

```text
pnpm test:replay <run number>
```

1. A small setup step reads the number from the number server. It opens no number and joins no number.
2. **It stops before any test when the number cannot be replayed** (section 5, problem 2), and says why.
3. It adds a replay suffix to every user name. The stored fixture does not change. The suffix differs for each replay, so two replays cannot collide.
4. It writes the values to the same file that `pnpm test:run` uses, and the specs run.
5. A spec that is newer than the number (its label is not in the records of the number) is **skipped with the reason**. It is not counted as replayed.
6. No finisher, no signals, and no retries. Nothing is written to `testschema`.

The suffix makes the user name longer. Where the length or the letters of the name are the subject, the replay is not the same input. The report shows the original name and the name that was used. It never shows a password.

### Step 3. Write a report of the replay

One JSON file for each replay, in a git-ignored folder. It is new and has nothing to do with the records of the numbered runs.

| Item | Why |
| --- | --- |
| Source run number, the day it was opened, and the commit of its tests | Which past input was used |
| Labels replayed, and labels skipped with the reason | What was really covered |
| Inputs that did not come from the number (problem 5) | What was not replayed |
| User names before and after the suffix | What was changed |
| Commit now, and whether there were uncommitted changes | Which code was tested |
| Versions of the server and the screens, then and now | What differs |
| Number server, and tested app (`local` or `EC2`, not the address) | They can be different |
| Result of each spec | Passed, failed, or skipped |

### Step 4. Choose a number

1. List the numbers with `GET /api/testRuns`. Leave out the blocked ones and those that cannot be replayed.
2. Narrow them by the date they were opened.
3. Look at the stored partitions, not at the formula. The rules may have changed since that number was opened.

The current formula does not cover all 108 combinations (3 x 3 x 3 x 4). The review counted 36 for numbers 1 to 108. Every pair of user name, name, and phone partitions appears in nine numbers in a row from 1 to 9. This is enough for now.

## 7. Done when

- `pnpm test:replay <n>` runs every spec that the number supports, with no copied spec.
- A number whose tests had uncommitted changes, or a commit without `ba7cd70`, is refused with a clear reason.
- The same number can be replayed twice in a row, and both runs sign up new users.
- Removing one stored value stops the spec with a clear message. No random value is used.
- A defect put into the code on purpose (for example, refusing a stored phone format) makes the replay fail.
- `testschema` has the same rows before and after a replay.
- Accounts made by a replay are removed. Users and transactions stay.
- `pnpm test`, `pnpm test:run`, and the demo work as before.

Try a replay on the test database first. Do not open new numbers in the development database without the owner's permission.

## 8. Limits to state openly

- A replay does not restore an old database and does not reproduce an old failure.
- Values from EC2 tested on a local app say nothing about the users on EC2.
- Version numbers are counted in each database. `0.101` on a PC and `0.101` on EC2 can be different code.
- Dates, replay suffixes, and the inputs of problem 5 are not the past input.
- Only the Web replays. The App decides for itself.

## 9. Later: looking at past people

Not part of this plan. If the owner wants it, design it on its own.

- It only reads: log in as a past user and look at lists, details, accounts, and settings.
- It runs where that user exists. The users of the deleted numbers 1 to 8 are still in the local `users` table, but nothing tells their values any more.
- It needs its own judgements. "Visible" does not prove that a long name does not cover the next line.
- Decide first which test data is kept and which is cleaned. The Web's 003 keeps its accounts in a numbered run, the App's 003 does not. The other tests delete their accounts fully, but users and transactions stay, so some transactions point to accounts that are gone.
- The three tools that were made for this (`get-past-users`, `pick-runs`, `set-my-profile`) were deleted on 2026-11-24, because nothing used them. They are in the history before that.

## 10. Questions for the owner

1. Is `pnpm test:replay <run number>` the right command name?
2. Is a local file enough for the results of a replay, or should they get a table of their own (apart from the records of the numbered runs)?
3. Must the demo in the browser show past values too, or only Playwright?
4. When is `testschema` applied to EC2? Until then, only local numbers can be replayed.
