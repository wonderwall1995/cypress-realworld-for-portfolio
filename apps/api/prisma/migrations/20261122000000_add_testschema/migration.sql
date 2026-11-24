-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "testschema";

-- CreateEnum
CREATE TYPE "testschema"."TestRunStatus" AS ENUM ('open', 'blocked');

-- CreateEnum
CREATE TYPE "testschema"."TestPlatform" AS ENUM ('web', 'app');

-- CreateEnum
CREATE TYPE "testschema"."PlatformRunStatus" AS ENUM ('waiting', 'running', 'finished', 'blocked');

-- CreateEnum
CREATE TYPE "testschema"."CodeKind" AS ENUM ('spec', 'common', 'api', 'util');

-- CreateEnum
CREATE TYPE "testschema"."CodeResultStatus" AS ENUM ('passed', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "testschema"."test_run" (
    "run_no" SERIAL NOT NULL,
    "status" "testschema"."TestRunStatus" NOT NULL DEFAULT 'open',
    "opened_by" "testschema"."TestPlatform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_pkey" PRIMARY KEY ("run_no")
);

-- CreateTable
CREATE TABLE "testschema"."test_fixture" (
    "run_no" INTEGER NOT NULL,
    "test_case" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_fixture_pkey" PRIMARY KEY ("run_no","test_case","item")
);

-- CreateTable
CREATE TABLE "testschema"."platform_run" (
    "id" SERIAL NOT NULL,
    "run_no" INTEGER NOT NULL,
    "platform" "testschema"."TestPlatform" NOT NULL,
    "status" "testschema"."PlatformRunStatus" NOT NULL DEFAULT 'running',
    "device" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_signal_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "platform_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testschema"."code_result" (
    "id" SERIAL NOT NULL,
    "run_no" INTEGER NOT NULL,
    "platform_run_id" INTEGER NOT NULL,
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

    CONSTRAINT "code_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_run_run_no_platform_key" ON "testschema"."platform_run"("run_no", "platform");

-- CreateIndex
CREATE INDEX "code_result_run_no_kind_idx" ON "testschema"."code_result"("run_no", "kind");

-- CreateIndex
CREATE INDEX "code_result_test_case_idx" ON "testschema"."code_result"("test_case");

-- AddForeignKey
ALTER TABLE "testschema"."test_fixture" ADD CONSTRAINT "test_fixture_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_run"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."platform_run" ADD CONSTRAINT "platform_run_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_run"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."code_result" ADD CONSTRAINT "code_result_run_no_fkey" FOREIGN KEY ("run_no") REFERENCES "testschema"."test_run"("run_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."code_result" ADD CONSTRAINT "code_result_platform_run_id_fkey" FOREIGN KEY ("platform_run_id") REFERENCES "testschema"."platform_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testschema"."code_result" ADD CONSTRAINT "code_result_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "testschema"."code_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

