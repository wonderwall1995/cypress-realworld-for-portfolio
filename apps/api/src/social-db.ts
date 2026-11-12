/**
 * Liking and commenting on a transaction, with the notifications that go out.
 *
 * Same rule as the old JSON-file version: the sender and the receiver of the transaction are both
 * notified. Only when the person acting is both the sender and the receiver is one
 * notification sent. The like/comment and its notifications are written in one database
 * transaction.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { Comment, Like, NotificationType } from "@rwa/shared";
import { createCommentNotification, createLikeNotification } from "./notification-db";
import { publishNotifications } from "./notification-stream";

// Who gets a notification (the old code notified the sender and the receiver in almost every case)
const recipients = (actingUserId: string, senderId: string, receiverId: string): string[] =>
  actingUserId !== senderId || actingUserId !== receiverId ? [senderId, receiverId] : [senderId];

export const createLikes = async (userId: string, transactionId: string): Promise<Like> => {
  const made: NotificationType[] = []; // sent to open streams only AFTER the commit
  const like = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new Error(`transaction not found: ${transactionId}`);

    const now = new Date();
    const like = await tx.like.create({
      data: { id: shortid(), uuid: v4(), userId, transactionId, createdAt: now, modifiedAt: now },
    });
    for (const recipient of recipients(userId, transaction.senderId, transaction.receiverId)) {
      made.push(await createLikeNotification(recipient, transactionId, like.id, tx));
    }
    return like;
  });
  await publishNotifications(made);
  return like;
};

export const createComments = async (
  userId: string,
  transactionId: string,
  content: string
): Promise<Comment> => {
  const made: NotificationType[] = []; // sent to open streams only AFTER the commit
  const comment = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new Error(`transaction not found: ${transactionId}`);

    const now = new Date();
    const comment = await tx.comment.create({
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
    for (const recipient of recipients(userId, transaction.senderId, transaction.receiverId)) {
      made.push(await createCommentNotification(recipient, transactionId, comment.id, tx));
    }
    return comment;
  });
  await publishNotifications(made);
  return comment;
};
