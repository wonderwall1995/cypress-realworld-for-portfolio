-- Money held in each bank account (cents). Existing accounts start at 0.
ALTER TABLE "bank_accounts" ADD COLUMN "balance" INTEGER NOT NULL DEFAULT 0;
