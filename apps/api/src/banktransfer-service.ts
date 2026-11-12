/**
 * Virtual deposit / withdrawal. No real bank is involved.
 *
 *   deposit    money enters one of the user's bank accounts: bank_accounts.balance goes up.
 *   withdrawal money leaves one of the user's bank accounts: balance goes down, never below 0.
 *   The transfer's balanceBefore / balanceAfter are the BANK ACCOUNT balance.
 *   users.balance (sidebar) is the sum of the user's bank accounts and is updated too.
 *
 * Everything for one request happens in ONE database transaction:
 *   1. the transfer is created as "requested"   (history row 1)
 *   2. the user's balance changes
 *   3. the transfer becomes "completed" with the balance before and after (history row 2)
 * If anything fails, nothing is saved. A rejected request leaves no record at all.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { HttpError } from "./http-error";
import { syncUserBalance } from "./account-money";
import {
  applyBankTransferStatusChange,
  BankTransferWithStatus,
  createBankTransfer,
} from "./banktransfer-db";
import {
  BankTransferType,
  EXTERNAL_DEPOSIT_NAME,
  EXTERNAL_DEPOSIT_SENDER_ID,
  MAX_BALANCE_CENTS,
  TransactionStatus,
} from "@rwa/shared";

export interface MoveMoneyInput {
  bankAccountId: string;
  amount: number; // whole dollars, like payments
  type: BankTransferType | "deposit" | "withdrawal";
}

export const moveMoney = (userId: string, input: MoveMoneyInput): Promise<BankTransferWithStatus> =>
  prisma.$transaction(async (tx) => {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new HttpError(400, "amount must be a whole number of dollars, 1 or more");
    }
    if (input.type !== "deposit" && input.type !== "withdrawal") {
      throw new HttpError(400, "type must be deposit or withdrawal");
    }

    const account = await tx.bankAccount.findUnique({ where: { id: input.bankAccountId } });
    if (!account) throw new HttpError(404, "bank account not found");
    if (account.userId !== userId) throw new HttpError(403, "this is not your bank account");
    if (!account.visible) throw new HttpError(400, "this bank account was deleted");

    // Lock the account row until the end of the transaction, so two requests at the same time
    // cannot both read the same balance (for example, two withdrawals overdrawing it).
    const deposit = input.type === "deposit";
    const rows = await tx.$queryRaw<{ balance: number }[]>`
      SELECT "balance" FROM "bank_accounts" WHERE "id" = ${account.id} FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "bank account not found");

    const before = rows[0].balance;
    const cents = input.amount * 100;
    const after = deposit ? before + cents : before - cents;

    if (!deposit && after < 0) throw new HttpError(400, "not enough balance");
    if (after > MAX_BALANCE_CENTS) throw new HttpError(400, "the balance would be too large");

    // A deposit also shows up in the feeds as an "outside deposit" transaction (only its owner sees it):
    // sender = fixed text, receiver = the user, private, already complete.
    let transactionId: string | undefined;
    if (deposit) {
      const now = new Date();
      const row = await tx.transaction.create({
        data: {
          id: shortid(),
          uuid: v4(),
          source: account.id,
          amount: cents,
          description: EXTERNAL_DEPOSIT_NAME,
          receiverId: userId,
          senderId: EXTERNAL_DEPOSIT_SENDER_ID,
          privacyLevel: "private",
          status: TransactionStatus.complete,
          requestStatus: "",
          requestResolvedAt: "",
          payeeAccountId: account.id,
          payeeBalanceAfter: after,
          createdAt: now,
          modifiedAt: now,
        },
      });
      transactionId = row.id;
    }

    const transfer = await createBankTransfer(
      {
        userId,
        source: account.id,
        amount: cents,
        transactionId,
        type: input.type as BankTransferType,
        status: "requested",
        note: deposit ? "virtual deposit requested" : "virtual withdrawal requested",
      },
      tx
    );

    await tx.bankAccount.update({
      where: { id: account.id },
      data: { balance: after, modifiedAt: new Date() },
    });
    await syncUserBalance(tx, userId);

    return applyBankTransferStatusChange(tx, transfer.id, "completed", {
      balanceBefore: before,
      balanceAfter: after,
      note: deposit ? "virtual deposit completed" : "virtual withdrawal completed",
    });
  });
