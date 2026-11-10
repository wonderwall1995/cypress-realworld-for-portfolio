-- CreateEnum
CREATE TYPE "BankTransferStatus" AS ENUM ('requested', 'completed', 'failed', 'canceled');

-- AlterTable
ALTER TABLE "bank_transfers" ADD COLUMN     "balanceAfter" INTEGER,
ADD COLUMN     "balanceBefore" INTEGER,
ADD COLUMN     "status" "BankTransferStatus" NOT NULL DEFAULT 'requested',
ALTER COLUMN "transactionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "bank_transfer_logs" (
    "id" TEXT NOT NULL,
    "bankTransferId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fromStatus" "BankTransferStatus",
    "toStatus" "BankTransferStatus" NOT NULL,
    "balanceBefore" INTEGER,
    "balanceAfter" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transfer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_transfer_logs_bankTransferId_idx" ON "bank_transfer_logs"("bankTransferId");

-- CreateIndex
CREATE INDEX "bank_transfer_logs_userId_createdAt_idx" ON "bank_transfer_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bank_transfers_source_idx" ON "bank_transfers"("source");

-- AddForeignKey
ALTER TABLE "bank_transfer_logs" ADD CONSTRAINT "bank_transfer_logs_bankTransferId_fkey" FOREIGN KEY ("bankTransferId") REFERENCES "bank_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
