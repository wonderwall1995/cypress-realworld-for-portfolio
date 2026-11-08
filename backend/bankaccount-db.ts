/**
 * Bank accounts stored in PostgreSQL (Prisma).
 * Same behaviour as the old lowdb functions in database.ts, but async.
 * The lowdb versions stay in database.ts until the unit tests are moved over.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { BankAccount } from "../src/models";

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

// soft delete: the row stays, isDeleted becomes true
export const removeBankAccountById = async (bankAccountId: string) => {
  await prisma.bankAccount.updateMany({
    where: { id: bankAccountId },
    data: { isDeleted: true, modifiedAt: new Date() },
  });
};
