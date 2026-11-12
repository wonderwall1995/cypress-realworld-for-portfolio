// Test helpers: money lives in bank accounts, so every test user needs one.
import prisma from "../../prisma";
import { createBankAccountForUser } from "../../bankaccount-db";
import { createTransaction } from "../../transaction-db";
import { syncUserBalance } from "../../account-money";

const accountOfUser = new Map<string, string>();

/** Give a user one bank account that holds `cents` (users.balance follows). Returns the account id. */
export const fundUser = async (userId: string, cents = 0): Promise<string> => {
  const account = await createBankAccountForUser(userId, {
    bankName: "Test Bank",
    accountNumber: "123456789",
  });
  if (cents) {
    await prisma.bankAccount.update({ where: { id: account.id }, data: { balance: cents } });
  }
  await syncUserBalance(prisma, userId);
  accountOfUser.set(userId, account.id);
  return account.id;
};

export const accountIdOf = (userId: string): string => accountOfUser.get(userId)!;

/** createTransaction with each side's (first) funded account filled in. */
export const createTx = (
  senderId: string,
  type: "payment",
  details: any,
  accounts: { myAccountId?: string; otherAccountId?: string } = {}
) =>
  createTransaction(senderId, type, {
    ...details,
    myAccountId: accounts.myAccountId ?? accountIdOf(senderId),
    otherAccountId: accounts.otherAccountId ?? accountIdOf(details.receiverId),
  });
