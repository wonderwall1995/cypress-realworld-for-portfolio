import { Prisma, PrismaClient } from "@prisma/client";

// One shared client for the whole backend (ts-node --watch reloads would otherwise open many connections)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// The shared client or the client inside prisma.$transaction(...). Repository functions take
// one as an optional last argument so several of them can run in one database transaction.
export type DbClient = Prisma.TransactionClient;

export default prisma;
