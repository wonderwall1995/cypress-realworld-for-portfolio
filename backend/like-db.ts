/**
 * Likes stored in PostgreSQL (Prisma).
 *
 * The notifications that go out when someone likes a transaction need the transaction's
 * sender and receiver, so that step lives in social-db.ts.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { Like } from "../src/models";

export const getAllLikes = (): Promise<Like[]> =>
  prisma.like.findMany({ orderBy: { createdAt: "asc" } });

export const getLikeById = async (id: string): Promise<Like | undefined> =>
  (await prisma.like.findUnique({ where: { id } })) ?? undefined;

export const getLikesByTransactionId = (transactionId: string): Promise<Like[]> =>
  prisma.like.findMany({ where: { transactionId }, orderBy: { createdAt: "asc" } });

export const createLike = (userId: string, transactionId: string): Promise<Like> => {
  const now = new Date();
  return prisma.like.create({
    data: { id: shortid(), uuid: v4(), userId, transactionId, createdAt: now, modifiedAt: now },
  });
};
