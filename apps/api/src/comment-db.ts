/**
 * Comments stored in PostgreSQL (Prisma).
 *
 * The notifications that go out when someone comments need the transaction's sender and
 * receiver, so that step lives in social-db.ts.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma, { DbClient } from "./prisma";
import { Comment, CommentResponseItem } from "@rwa/shared";

export const getAllComments = (): Promise<Comment[]> =>
  prisma.comment.findMany({ orderBy: { createdAt: "asc" } });

export const getCommentById = async (id: string): Promise<Comment | undefined> =>
  (await prisma.comment.findUnique({ where: { id } })) ?? undefined;

export const getCommentsByTransactionId = (transactionId: string): Promise<Comment[]> =>
  prisma.comment.findMany({ where: { transactionId }, orderBy: { createdAt: "asc" } });

/** Adds the name of the writer (last name, first name). One question to the database for all comments. */
export const withCommentAuthors = async (
  comments: Comment[],
  client: DbClient = prisma
): Promise<CommentResponseItem[]> => {
  if (comments.length === 0) return [];
  const users = await client.user.findMany({
    where: { id: { in: [...new Set(comments.map((comment) => comment.userId))] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameOf = new Map(users.map((user) => [user.id, `${user.lastName} ${user.firstName}`]));
  return comments.map((comment) => ({
    ...comment,
    userFullName: nameOf.get(comment.userId) ?? "",
  }));
};

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
