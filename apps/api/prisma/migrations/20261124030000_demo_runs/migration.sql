-- CreateEnum
CREATE TYPE "testschema"."DemoRunMode" AS ENUM ('all', 'partial');

-- CreateEnum
CREATE TYPE "testschema"."DemoRunStatus" AS ENUM ('running', 'paused', 'finished', 'failed', 'stopped');

-- CreateEnum
CREATE TYPE "testschema"."DemoStopReason" AS ENUM ('button', 'closed', 'lost');

-- CreateTable
CREATE TABLE "testschema"."demo_run" (
    "id" SERIAL NOT NULL,
    "mode" "testschema"."DemoRunMode" NOT NULL,
    "status" "testschema"."DemoRunStatus" NOT NULL DEFAULT 'running',
    "stop_reason" "testschema"."DemoStopReason",
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_signal_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "token_hash" TEXT NOT NULL,

    CONSTRAINT "demo_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testschema"."demo_test_record" (
    "id" SERIAL NOT NULL,
    "demo_run_id" INTEGER NOT NULL,
    "test_case" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "status" "testschema"."CodeResultStatus" NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "demo_test_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_run_status_last_signal_at_idx" ON "testschema"."demo_run"("status", "last_signal_at");

-- CreateIndex
CREATE INDEX "demo_test_record_demo_run_id_idx" ON "testschema"."demo_test_record"("demo_run_id");

-- AddForeignKey
ALTER TABLE "testschema"."demo_test_record" ADD CONSTRAINT "demo_test_record_demo_run_id_fkey" FOREIGN KEY ("demo_run_id") REFERENCES "testschema"."demo_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

