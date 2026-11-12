/**
 * Bank accounts stored in PostgreSQL (Prisma).
 * Same behaviour as the old JSON-file (lowdb) functions, but async.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { BankAccount, isValidAccountNumber } from "@rwa/shared";
import { HttpError } from "./http-error";

export const getBankAccountsByUserId = (userId: string) =>
  prisma.bankAccount.findMany({ where: { userId, visible: true }, orderBy: { createdAt: "asc" } });

export const getBankAccountById = (id: string) => prisma.bankAccount.findUnique({ where: { id } });

export const createBankAccountForUser = async (
  userId: string,
  accountDetails: Partial<BankAccount>
) => {
  // checked here (not only in the REST route) because the web app creates accounts through GraphQL
  if (typeof accountDetails.bankName !== "string" || accountDetails.bankName.trim() === "") {
    throw new HttpError(400, "bankName is required");
  }
  if (!isValidAccountNumber(accountDetails.accountNumber)) {
    throw new HttpError(400, "accountNumber must be 9 to 12 digits");
  }

  const now = new Date();
  return prisma.bankAccount.create({
    data: {
      id: shortid(),
      uuid: v4(),
      userId,
      bankName: accountDetails.bankName!,
      accountNumber: accountDetails.accountNumber!,
      visible: true,
      balance: 0,
      createdAt: now,
      modifiedAt: now,
    },
  });
};

// soft delete: the row stays, visible becomes false.
// Only the owner can delete an account, and only an empty one (a balance cannot just disappear).
// Returns true when an account was found and marked.
// An id that does not exist, or one that belongs to someone else, changes nothing and returns false.
export const removeBankAccountById = async (
  userId: string,
  bankAccountId: string
): Promise<boolean> =>
  prisma.$transaction(async (tx) => {
    const account = await tx.bankAccount.findFirst({ where: { id: bankAccountId, userId } });
    if (!account) return false;
    if (account.balance !== 0) {
      throw new HttpError(400, "an account with a balance cannot be deleted");
    }
    await tx.bankAccount.update({
      where: { id: bankAccountId },
      data: { visible: false, modifiedAt: new Date() },
    });
    return true;
  });
