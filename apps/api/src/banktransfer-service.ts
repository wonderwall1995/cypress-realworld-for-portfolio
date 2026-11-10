/**
 * Virtual deposit / withdrawal between one of the user's bank accounts and the app balance.
 * No real bank is involved: the value is only moved from one place to the other.
 *
 *   deposit    bank account -> app balance (balance goes up)
 *   withdrawal app balance -> bank account (balance goes down, never below 0)
 *
 * Everything for one request happens in ONE database transaction:
 *   1. the transfer is created as "requested"   (history row 1)
 *   2. the user's balance changes
 *   3. the transfer becomes "completed" with the balance before and after (history row 2)
 * If anything fails, nothing is saved. A rejected request leaves no record at all.
 */
import prisma from "./prisma";
import { HttpError } from "./http-error";
import {
  applyBankTransferStatusChange,
  BankTransferWithStatus,
  createBankTransfer,
} from "./banktransfer-db";
import { BankTransferType, MAX_BALANCE_CENTS } from "@rwa/shared";

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

    // Lock the user's row until the end of the transaction, so two requests at the same
    // time cannot both read the same balance (for example, two withdrawals overdrawing it).
    const rows = await tx.$queryRaw<{ balance: number }[]>`
      SELECT "balance" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    if (rows.length === 0) throw new HttpError(404, "user not found");

    const before = rows[0].balance;
    const cents = input.amount * 100;
    const deposit = input.type === "deposit";
    const after = deposit ? before + cents : before - cents;

    if (!deposit && after < 0) throw new HttpError(400, "not enough balance");
    if (after > MAX_BALANCE_CENTS) throw new HttpError(400, "the balance would be too large");

    const transfer = await createBankTransfer(
      {
        userId,
        source: account.id,
        amount: cents,
        type: input.type as BankTransferType,
        status: "requested",
        note: deposit ? "virtual deposit requested" : "virtual withdrawal requested",
      },
      tx
    );

    await tx.user.update({
      where: { id: userId },
      data: { balance: after, modifiedAt: new Date() },
    });

    return applyBankTransferStatusChange(tx, transfer.id, "completed", {
      balanceBefore: before,
      balanceAfter: after,
      note: deposit ? "virtual deposit completed" : "virtual withdrawal completed",
    });
  });
