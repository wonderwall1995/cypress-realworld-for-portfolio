import { assertTestDatabase } from "./testDb";

/** Empty every app table (not the Prisma migration table). Test database only. */
export async function resetDatabase(prisma: {
  $executeRawUnsafe: (q: string) => Promise<unknown>;
}) {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "bank_transfer_logs", "bank_transfers", "notifications", "comments", "likes", "transactions", "bank_accounts", "contacts", "users" RESTART IDENTITY CASCADE'
  );
}
