/**
 * Notification list for the API: each notification gets the full name of the person it is about.
 *
 * Whose name is shown (same order of rules as the old JSON-file version, later rules win):
 *   1. the notification's own user
 *   2. a received transfer: the sender of the transaction
 *   3. a like notification: the person who liked
 *   4. a comment notification: the person who commented
 * The live stream (notification-stream.ts) sends items made by this same function.
 * Needs users, transactions, likes and comments, so it is separate from notification-db.ts.
 */
import prisma from "./prisma";
import { NotificationResponseItem, NotificationType } from "@rwa/shared";
import { isCommentNotification, isLikeNotification } from "@rwa/shared";
import { getUnreadNotificationsByUserId } from "./notification-db";

export const formatNotificationsForApiResponse = async (
  notifications: NotificationType[]
): Promise<NotificationResponseItem[]> => {
  if (notifications.length === 0) return [];

  const transactionIds = [...new Set(notifications.map((n) => n.transactionId))];
  const likeIds = notifications.filter(isLikeNotification).map((n: any) => n.likeId);
  const commentIds = notifications.filter(isCommentNotification).map((n: any) => n.commentId);

  const [transactions, likes, comments] = await Promise.all([
    prisma.transaction.findMany({ where: { id: { in: transactionIds } } }),
    prisma.like.findMany({ where: { id: { in: likeIds } } }),
    prisma.comment.findMany({ where: { id: { in: commentIds } } }),
  ]);
  const transactionById = new Map(transactions.map((t) => [t.id, t]));
  const likeById = new Map(likes.map((l) => [l.id, l]));
  const commentById = new Map(comments.map((c) => [c.id, c]));

  const userIds = [
    ...new Set([
      ...notifications.map((n) => n.userId),
      ...transactions.map((t) => t.senderId),
      ...likes.map((l) => l.userId),
      ...comments.map((c) => c.userId),
    ]),
  ];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const nameOf = (id?: string) => {
    const user = users.find((u) => u.id === id);
    return user ? `${user.lastName} ${user.firstName}` : "";
  };

  return notifications.map((notification) => {
    let userFullName = nameOf(notification.userId);

    const transaction = transactionById.get(notification.transactionId);
    // a received transfer names who SENT it
    if (transaction && (notification as { status?: string }).status === "received") {
      userFullName = nameOf(transaction.senderId);
    }
    if (isLikeNotification(notification)) {
      const like = likeById.get(notification.likeId);
      if (like) userFullName = nameOf(like.userId);
    }
    if (isCommentNotification(notification)) {
      const comment = commentById.get(notification.commentId);
      if (comment) userFullName = nameOf(comment.userId);
    }
    return { userFullName, ...notification } as NotificationResponseItem;
  });
};

// Unread notifications of a user, newest first, ready for the API.
export const getUnreadNotificationsForApi = async (
  userId: string
): Promise<NotificationResponseItem[]> =>
  formatNotificationsForApiResponse(await getUnreadNotificationsByUserId(userId));
