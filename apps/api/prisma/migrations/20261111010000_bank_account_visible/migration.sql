-- isDeleted (true = deleted) becomes visible (false = deleted). Existing rows keep their meaning.
ALTER TABLE "bank_accounts" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;
UPDATE "bank_accounts" SET "visible" = NOT "isDeleted";
ALTER TABLE "bank_accounts" ALTER COLUMN "visible" DROP DEFAULT;
ALTER TABLE "bank_accounts" DROP COLUMN "isDeleted";
