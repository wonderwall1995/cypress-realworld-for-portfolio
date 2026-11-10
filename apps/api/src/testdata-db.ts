/**
 * Helpers for the /testData routes (only mounted when NODE_ENV is "test").
 * They let an end-to-end test start from an empty database and look at what is stored.
 * There is no sample data: tests create the data they need through the API.
 */
import prisma from "./prisma";

const MODELS = {
  users: () => prisma.user.findMany(),
  contacts: () => prisma.contact.findMany(),
  bankaccounts: () => prisma.bankAccount.findMany(),
  transactions: () => prisma.transaction.findMany(),
  likes: () => prisma.like.findMany(),
  comments: () => prisma.comment.findMany(),
  notifications: () => prisma.notification.findMany(),
  banktransfers: () => prisma.bankTransfer.findMany(),
} as const;

export type TestDataEntity = keyof typeof MODELS;

export const getAllForEntity = (entity: TestDataEntity) => MODELS[entity]();

/** Remove every row from every app table. Never touches the Prisma migration table. */
export const resetDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "bank_transfer_logs", "bank_transfers", "notifications", "comments", "likes", "transactions", "bank_accounts", "contacts", "users" RESTART IDENTITY CASCADE'
  );
};
