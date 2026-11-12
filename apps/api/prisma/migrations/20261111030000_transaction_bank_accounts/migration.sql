-- Transactions now remember which bank accounts the money moved between, and the balances after.
ALTER TABLE "transactions" ADD COLUMN "payerAccountId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "payeeAccountId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "payerBalanceAfter" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "payeeBalanceAfter" INTEGER;

-- users.balance is now the sum of the user's visible bank accounts (kept in step by the server).
-- Money that only existed as the old "app balance" is not carried over (agreed: no backup).
UPDATE "users" u SET "balance" = COALESCE(
  (SELECT SUM(b."balance") FROM "bank_accounts" b WHERE b."userId" = u."id" AND b."visible"), 0);
