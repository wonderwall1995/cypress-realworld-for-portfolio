/**
 * Bank accounts stored in PostgreSQL (Prisma).
 * Same behaviour as the old JSON-file (lowdb) functions, but async.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { BankAccount } from "@rwa/shared";

export const getBankAccountsByUserId = (userId: string) =>
  prisma.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

export const getBankAccountById = (id: string) => prisma.bankAccount.findUnique({ where: { id } });

export const createBankAccountForUser = (userId: string, accountDetails: Partial<BankAccount>) => {
  const now = new Date();
  return prisma.bankAccount.create({
    data: {
      id: shortid(),
      uuid: v4(),
      userId,
      bankName: accountDetails.bankName!,
      accountNumber: accountDetails.accountNumber!,
      routingNumber: accountDetails.routingNumber!,
      isDeleted: false,
      createdAt: now,
      modifiedAt: now,
    },
  });
};

// soft delete: the row stays, isDeleted becomes true.
// Only the owner can delete an account. Returns true when an account was found and marked.
// An id that does not exist, or one that belongs to someone else, changes nothing and returns false.
export const removeBankAccountById = async (
  userId: string,
  bankAccountId: string
): Promise<boolean> => {
  const { count } = await prisma.bankAccount.updateMany({
    where: { id: bankAccountId, userId },
    data: { isDeleted: true, modifiedAt: new Date() },
  });
  return count > 0;
};
