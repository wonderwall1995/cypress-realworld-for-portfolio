-- Which code a numbered run worked with. Older numbers keep empty columns (it was not recorded then).

-- CreateEnum
CREATE TYPE "testschema"."VersionPart" AS ENUM ('server', 'web', 'app');

-- CreateTable
CREATE TABLE "testschema"."test_version" (
    "part" "testschema"."VersionPart" NOT NULL,
    "version" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_version_pkey" PRIMARY KEY ("part","version")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_version_part_major_fingerprint_key" ON "testschema"."test_version"("part", "major", "fingerprint");

-- AlterTable
ALTER TABLE "testschema"."run_progress" ADD COLUMN     "server_version" TEXT,
ADD COLUMN     "server_version_end" TEXT,
ADD COLUMN     "target_version" TEXT,
ADD COLUMN     "test_commit" TEXT,
ADD COLUMN     "test_dirty" BOOLEAN;

-- The view gets the versions. same_server: both platforms had one and the same server from their start to their end.
-- Empty: not both have ended, or the versions are not known.
DROP VIEW "testschema"."final_test_report";
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
  CASE WHEN w."result" IS NOT NULL AND a."result" IS NOT NULL THEN GREATEST(w."reported_at", a."reported_at") END AS "decided_at",
  CASE
    WHEN wp."server_version" IS NULL OR wp."server_version_end" IS NULL
      OR ap."server_version" IS NULL OR ap."server_version_end" IS NULL THEN NULL
    ELSE wp."server_version" = wp."server_version_end"
      AND ap."server_version" = ap."server_version_end"
      AND wp."server_version" = ap."server_version"
  END AS "same_server",
  wp."target_version" AS "web_version", wp."server_version" AS "web_server_version", wp."server_version_end" AS "web_server_version_end",
  wp."test_commit" AS "web_test_commit", wp."test_dirty" AS "web_test_dirty",
  ap."target_version" AS "app_version", ap."server_version" AS "app_server_version", ap."server_version_end" AS "app_server_version_end",
  ap."test_commit" AS "app_test_commit", ap."test_dirty" AS "app_test_dirty"
FROM "testschema"."test_fixture" f
LEFT JOIN "testschema"."web_test_report" w ON w."run_no" = f."run_no"
LEFT JOIN "testschema"."app_test_report" a ON a."run_no" = f."run_no"
LEFT JOIN "testschema"."run_progress" wp ON wp."run_no" = f."run_no" AND wp."platform" = 'web'
LEFT JOIN "testschema"."run_progress" ap ON ap."run_no" = f."run_no" AND ap."platform" = 'app';
