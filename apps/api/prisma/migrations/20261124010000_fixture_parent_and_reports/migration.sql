-- The fixtures become the parent: one row per number (test_fixture) and three people (test_fixture_person).
-- Records and reports get one table per platform. test_run, platform_run and code_result go away.
--
-- Kept from the older numbers: the people of "transfer", the amounts and comments, the progress and every record.
-- Dropped for good: the people of the other tests (agreed with the User, 2026-11-24).

-- 1. The old table makes room for the new one of the same name
ALTER TABLE "testschema"."test_fixture" RENAME TO "old_test_fixture";
ALTER TABLE "testschema"."old_test_fixture" RENAME CONSTRAINT "test_fixture_pkey" TO "old_test_fixture_pkey";

-- 2. The new tables
-- CreateEnum
CREATE TYPE "testschema"."TestPerson" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "testschema"."RunStatus" AS ENUM ('running', 'finished', 'blocked');

-- CreateEnum
CREATE TYPE "testschema"."ReportResult" AS ENUM ('passed', 'failed', 'blocked');

-- CreateTable
CREATE TABLE "testschema"."test_fixture" (
    "run_no" INTEGER NOT NULL,
    "opened_by" "testschema"."TestPlatform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transfer_cycle_dollars" INTEGER,
    "detail_dollars" INTEGER,
    "detail_comment" TEXT,
    "filter_sent_small_dollars" INTEGER,
    "filter_sent_big_dollars" INTEGER,
    "filter_got_small_dollars" INTEGER,
    "filter_got_big_dollars" INTEGER,

    CONSTRAINT "test_fixture_pkey" PRIMARY KEY ("run_no")
);

-- CreateTable
CREATE TABLE "testschema"."test_fixture_person" (
    "run_no" INTEGER NOT NULL,
    "person" "testschema"."TestPerson" NOT NULL,
    "username_base" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "partition_username" TEXT NOT NULL,
    "partition_name" TEXT NOT NULL,
    "partition_phone" TEXT NOT NULL,
    "partition_account_length" INTEGER NOT NULL,

    CONSTRAINT "test_fixture_person_pkey" PRIMARY KEY ("run_no","person")
);

-- CreateTable
CREATE TABLE "testschema"."run_progress" (
    "run_no" INTEGER NOT NULL,
    "platform" "testschema"."TestPlatform" NOT NULL,
    "status" "testschema"."RunStatus" NOT NULL DEFAULT 'running',
    "device" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_signal_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "run_progress_pkey" PRIMARY KEY ("run_no","platform")
);

-- CreateTable
CREATE TABLE "testschema"."web_test_record" (
    "id" SERIAL NOT NULL,
    "run_no" INTEGER NOT NULL,
    "kind" "testschema"."CodeKind" NOT NULL,
    "test_case" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "parent_id" INTEGER,
    "status" "testschema"."CodeResultStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "web_test_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testschema"."app_test_record" (
    "id" SERIAL NOT NULL,
    "run_no" INTEGER NOT NULL,
    "kind" "testschema"."CodeKind" NOT NULL,
    "test_case" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "parent_id" INTEGER,
    "status" "testschema"."CodeResultStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "app_test_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testschema"."web_test_report" (
    "run_no" INTEGER NOT NULL,
    "spec_ok" BOOLEAN,
    "common_ok" BOOLEAN,
    "api_ok" BOOLEAN,
    "result" "testschema"."ReportResult" NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_test_report_pkey" PRIMARY KEY ("run_no")
);

-- CreateTable
CREATE TABLE "testschema"."app_test_report" (
    "run_no" INTEGER NOT NULL,
    "spec_ok" BOOLEAN,
    "common_ok" BOOLEAN,
    "api_ok" BOOLEAN,
    "result" "testschema"."ReportResult" NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_test_report_pkey" PRIMARY KEY ("run_no")
);

-- CreateIndex
CREATE INDEX "web_test_record_run_no_kind_idx" ON "testschema"."web_test_record"("run_no", "kind");

-- CreateIndex
CREATE INDEX "web_test_record_test_case_idx" ON "testschema"."web_test_record"("test_case");

-- CreateIndex
CREATE INDEX "app_test_record_run_no_kind_idx" ON "testschema"."app_test_record"("run_no", "kind");

-- CreateIndex
CREATE INDEX "app_test_record_test_case_idx" ON "testschema"."app_test_record"("test_case");

-- AddForeignKey
ALTER TABLE "testschema"."test_fixture_person" ADD CONSTRAINT "test_fixture_person_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_fixture"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."run_progress" ADD CONSTRAINT "run_progress_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_fixture"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."web_test_record" ADD CONSTRAINT "web_test_record_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_fixture"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."web_test_record" ADD CONSTRAINT "web_test_record_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "testschema"."web_test_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."app_test_record" ADD CONSTRAINT "app_test_record_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_fixture"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."app_test_record" ADD CONSTRAINT "app_test_record_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "testschema"."app_test_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."web_test_report" ADD CONSTRAINT "web_test_report_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_fixture"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."app_test_report" ADD CONSTRAINT "app_test_report_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_fixture"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Copy what is kept
INSERT INTO "testschema"."test_fixture" ("run_no", "opened_by", "created_at", "transfer_cycle_dollars", "detail_dollars", "detail_comment", "filter_sent_small_dollars", "filter_sent_big_dollars", "filter_got_small_dollars", "filter_got_big_dollars")
SELECT r."run_no", r."opened_by", r."created_at",
  (SELECT o."value"::int FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transfer' AND o."item" = 'cycleDollars'),
  (SELECT o."value"::int FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transaction-detail' AND o."item" = 'dollars'),
  (SELECT o."value" FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transaction-detail' AND o."item" = 'comment'),
  (SELECT o."value"::int FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transaction-filter' AND o."item" = 'sentSmallDollars'),
  (SELECT o."value"::int FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transaction-filter' AND o."item" = 'sentBigDollars'),
  (SELECT o."value"::int FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transaction-filter' AND o."item" = 'gotSmallDollars'),
  (SELECT o."value"::int FROM "testschema"."old_test_fixture" o WHERE o."run_no" = r."run_no" AND o."test_case" = 'transaction-filter' AND o."item" = 'gotBigDollars')
FROM "testschema"."test_run" r;

INSERT INTO "testschema"."test_fixture_person" ("run_no", "person", "username_base", "first_name", "last_name", "phone_number", "bank_name", "account_number", "partition_username", "partition_name", "partition_phone", "partition_account_length")
SELECT o."run_no", split_part(o."item", '.', 1)::"testschema"."TestPerson",
  MAX(o."value") FILTER (WHERE split_part(o."item", '.', 2) = 'usernameBase'),
  MAX(o."value") FILTER (WHERE split_part(o."item", '.', 2) = 'firstName'),
  MAX(o."value") FILTER (WHERE split_part(o."item", '.', 2) = 'lastName'),
  MAX(o."value") FILTER (WHERE split_part(o."item", '.', 2) = 'phoneNumber'),
  MAX(o."value") FILTER (WHERE split_part(o."item", '.', 2) = 'bankName'),
  MAX(o."value") FILTER (WHERE split_part(o."item", '.', 2) = 'accountNumber'),
  MAX(o."value") FILTER (WHERE o."item" LIKE '_.partition.username'),
  MAX(o."value") FILTER (WHERE o."item" LIKE '_.partition.name'),
  MAX(o."value") FILTER (WHERE o."item" LIKE '_.partition.phone'),
  MAX(o."value") FILTER (WHERE o."item" LIKE '_.partition.accountLength')::int
FROM "testschema"."old_test_fixture" o
WHERE o."test_case" = 'transfer' AND o."item" LIKE '_.%'
GROUP BY o."run_no", split_part(o."item", '.', 1);

INSERT INTO "testschema"."run_progress" ("run_no", "platform", "status", "device", "started_at", "last_signal_at", "finished_at")
SELECT "run_no", "platform", (CASE WHEN "status" = 'waiting' THEN 'blocked' ELSE "status"::text END)::"testschema"."RunStatus", "device", "started_at", "last_signal_at", "finished_at"
FROM "testschema"."platform_run";

INSERT INTO "testschema"."web_test_record" ("id", "run_no", "kind", "test_case", "name", "file", "parent_id", "status", "attempt", "error_message", "started_at", "duration_ms")
SELECT c."id", c."run_no", c."kind", c."test_case", c."name", c."file", c."parent_id", c."status", c."attempt", c."error_message", c."started_at", c."duration_ms"
FROM "testschema"."code_result" c
JOIN "testschema"."platform_run" p ON p."id" = c."platform_run_id"
WHERE p."platform" = 'web';
SELECT setval(pg_get_serial_sequence('"testschema"."web_test_record"', 'id'), COALESCE(MAX("id"), 0) + 1, false) FROM "testschema"."web_test_record";

INSERT INTO "testschema"."app_test_record" ("id", "run_no", "kind", "test_case", "name", "file", "parent_id", "status", "attempt", "error_message", "started_at", "duration_ms")
SELECT c."id", c."run_no", c."kind", c."test_case", c."name", c."file", c."parent_id", c."status", c."attempt", c."error_message", c."started_at", c."duration_ms"
FROM "testschema"."code_result" c
JOIN "testschema"."platform_run" p ON p."id" = c."platform_run_id"
WHERE p."platform" = 'app';
SELECT setval(pg_get_serial_sequence('"testschema"."app_test_record"', 'id'), COALESCE(MAX("id"), 0) + 1, false) FROM "testschema"."app_test_record";

-- 4. The reports of the numbers that have records (numbers without records get none)
INSERT INTO "testschema"."web_test_report" ("run_no", "spec_ok", "common_ok", "api_ok", "result", "reported_at")
SELECT r."run_no",
  BOOL_AND(r."status" <> 'failed') FILTER (WHERE r."kind" = 'spec' AND r."status" <> 'skipped'),
  BOOL_AND(r."status" <> 'failed') FILTER (WHERE r."kind" = 'common' AND r."status" <> 'skipped'),
  BOOL_AND(r."status" <> 'failed') FILTER (WHERE r."kind" = 'api' AND r."status" <> 'skipped'),
  CASE WHEN BOOL_OR(r."status" = 'failed') THEN 'failed' ELSE 'passed' END::"testschema"."ReportResult",
  COALESCE(p."finished_at", p."last_signal_at")
FROM "testschema"."web_test_record" r
JOIN "testschema"."run_progress" p ON p."run_no" = r."run_no" AND p."platform" = 'web' AND p."status" = 'finished'
GROUP BY r."run_no", p."finished_at", p."last_signal_at";
INSERT INTO "testschema"."web_test_report" ("run_no", "result", "reported_at")
SELECT "run_no", 'blocked', "last_signal_at" FROM "testschema"."run_progress"
WHERE "platform" = 'web' AND "status" = 'blocked';

INSERT INTO "testschema"."app_test_report" ("run_no", "spec_ok", "common_ok", "api_ok", "result", "reported_at")
SELECT r."run_no",
  BOOL_AND(r."status" <> 'failed') FILTER (WHERE r."kind" = 'spec' AND r."status" <> 'skipped'),
  BOOL_AND(r."status" <> 'failed') FILTER (WHERE r."kind" = 'common' AND r."status" <> 'skipped'),
  BOOL_AND(r."status" <> 'failed') FILTER (WHERE r."kind" = 'api' AND r."status" <> 'skipped'),
  CASE WHEN BOOL_OR(r."status" = 'failed') THEN 'failed' ELSE 'passed' END::"testschema"."ReportResult",
  COALESCE(p."finished_at", p."last_signal_at")
FROM "testschema"."app_test_record" r
JOIN "testschema"."run_progress" p ON p."run_no" = r."run_no" AND p."platform" = 'app' AND p."status" = 'finished'
GROUP BY r."run_no", p."finished_at", p."last_signal_at";
INSERT INTO "testschema"."app_test_report" ("run_no", "result", "reported_at")
SELECT "run_no", 'blocked', "last_signal_at" FROM "testschema"."run_progress"
WHERE "platform" = 'app' AND "status" = 'blocked';

-- 5. The old tables and lists of values go away
DROP TABLE "testschema"."code_result";
DROP TABLE "testschema"."platform_run";
DROP TABLE "testschema"."old_test_fixture";
DROP TABLE "testschema"."test_run";
DROP TYPE "testschema"."PlatformRunStatus";
DROP TYPE "testschema"."TestRunStatus";

-- 6. Both reports of a number in one row, with the final result (for Grafana). A view: it cannot differ from the reports.
-- blocked: one platform stopped midway. pending: one platform has not ended (or never ran this number).
CREATE VIEW "testschema"."final_test_report" AS
SELECT f."run_no", f."created_at",
  w."spec_ok" AS "web_spec_ok", w."common_ok" AS "web_common_ok", w."api_ok" AS "web_api_ok", w."result" AS "web_result",
  a."spec_ok" AS "app_spec_ok", a."common_ok" AS "app_common_ok", a."api_ok" AS "app_api_ok", a."result" AS "app_result",
  CASE
    WHEN 'blocked' IN (w."result", a."result") THEN 'blocked'
    WHEN w."result" IS NULL OR a."result" IS NULL THEN 'pending'
    WHEN w."result" = 'passed' AND a."result" = 'passed' THEN 'passed'
    ELSE 'failed'
  END AS "final_result",
  CASE WHEN w."result" IS NOT NULL AND a."result" IS NOT NULL THEN GREATEST(w."reported_at", a."reported_at") END AS "decided_at"
FROM "testschema"."test_fixture" f
LEFT JOIN "testschema"."web_test_report" w ON w."run_no" = f."run_no"
LEFT JOIN "testschema"."app_test_report" a ON a."run_no" = f."run_no";
