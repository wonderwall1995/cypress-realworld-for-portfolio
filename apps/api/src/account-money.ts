/**
 * Money lives in bank accounts (bank_accounts.balance, cents).
 * users.balance is only the sum of a user's visible accounts, kept in step by syncUserBalance.
 * Everything here runs inside the caller's database transaction.
 */
import bcrypt from "bcryptjs";
import prisma, { DbClient } from "./prisma";
import { HttpError } from "./http-error";
import { MAX_BALANCE_CENTS } from "@rwa/shared";

/** The account must exist, belong to `ownerId` and not be deleted. Otherwise an HttpError. */
export const loadUsableAccount = async (
  tx: DbClient,
  accountId: unknown,
  ownerId: string,
  whose: "my" | "the receiver's"
) => {
  if (typeof accountId !== "string" || accountId === "") {
    throw new HttpError(400, `choose ${whose} bank account`);
  }
  const account = await tx.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new HttpError(404, "bank account not found");
  if (account.userId !== ownerId) throw new HttpError(403, `this is not ${whose} bank account`);
  if (!account.visible) throw new HttpError(400, "this bank account was deleted");
  return account;
};

/** users.balance = sum of the user's visible bank accounts. */
export const syncUserBalance = (tx: DbClient, userId: string) =>
  tx.$executeRaw`
    UPDATE "users" SET "balance" = COALESCE(
      (SELECT SUM("balance") FROM "bank_accounts" WHERE "userId" = ${userId} AND "visible"), 0)
    WHERE "id" = ${userId}`;

/**
 * Move cents from one bank account to another.
 * Both rows are locked (always in id order, so two opposite transfers cannot wait for each other),
 * the payer must have enough, the payee must not pass the database limit.
 * Returns both balances after the move.
 */
export const moveBetweenAccounts = async (
  tx: DbClient,
  payerAccountId: string,
  payeeAccountId: string,
  cents: number
) => {
  if (payerAccountId === payeeAccountId) {
    throw new HttpError(400, "choose two different bank accounts");
  }
  const ids = [payerAccountId, payeeAccountId].sort();
  const rows = await tx.$queryRaw<{ id: string; userId: string; balance: number }[]>`
    SELECT "id", "userId", "balance" FROM "bank_accounts"
    WHERE "id" IN (${ids[0]}, ${ids[1]}) ORDER BY "id" FOR UPDATE`;
  const payer = rows.find((r) => r.id === payerAccountId);
  const payee = rows.find((r) => r.id === payeeAccountId);
  if (!payer || !payee) throw new HttpError(404, "bank account not found");

  if (payer.balance < cents) throw new HttpError(400, "not enough balance in this bank account");
  if (payee.balance + cents > MAX_BALANCE_CENTS) {
    throw new HttpError(400, "the receiving bank account balance would be too large");
  }

  const payerAfter = payer.balance - cents;
  const payeeAfter = payee.balance + cents;
  const now = new Date();
  await tx.bankAccount.update({
    where: { id: payer.id },
    data: { balance: payerAfter, modifiedAt: now },
  });
  await tx.bankAccount.update({
    where: { id: payee.id },
    data: { balance: payeeAfter, modifiedAt: now },
  });
  await syncUserBalance(tx, payer.userId);
  if (payee.userId !== payer.userId) await syncUserBalance(tx, payee.userId);

  return { payerAfter, payeeAfter };
};

/** True when the typed password is this user's password (used before money leaves an account). */
export const passwordMatches = async (userId: string, password: unknown): Promise<boolean> => {
  if (typeof password !== "string" || password === "") return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return !!user && bcrypt.compareSync(password, user.password);
};
