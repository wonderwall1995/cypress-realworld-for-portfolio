/**
 * Comments stored in PostgreSQL (Prisma).
 *
 * The notifications that go out when someone comments need the transaction's sender and
 * receiver, so that step lives in social-db.ts.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { Comment } from "@rwa/shared";

export const getAllComments = (): Promise<Comment[]> =>
  prisma.comment.findMany({ orderBy: { createdAt: "asc" } });

export const getCommentById = async (id: string): Promise<Comment | undefined> =>
  (await prisma.comment.findUnique({ where: { id } })) ?? undefined;

export const getCommentsByTransactionId = (transactionId: string): Promise<Comment[]> =>
  prisma.comment.findMany({ where: { transactionId }, orderBy: { createdAt: "asc" } });

export const createComment = (
  userId: string,
  transactionId: string,
  content: string
): Promise<Comment> => {
  const now = new Date();
  return prisma.comment.create({
    data: {
      id: shortid(),
      uuid: v4(),
      content,
      userId,
      transactionId,
      createdAt: now,
      modifiedAt: now,
    },
  });
};
