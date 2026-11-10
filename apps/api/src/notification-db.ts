/**
 * Notifications stored in PostgreSQL (Prisma). Replaces the old JSON-file (lowdb)
 * notification functions.
 *
 * One table holds three kinds: payment (has status), like (has likeId), comment (has commentId).
 * Rows come back in the old shape: only the field that belongs to the kind is present.
 *
 * Adding the user's full name for the API response needs transactions, likes and comments,
 * so that step is in notification-api.ts.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import type { Notification as NotificationRow } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import {
  CommentNotification,
  LikeNotification,
  NotificationPayloadType,
  NotificationsType,
  NotificationType,
  PaymentNotification,
  PaymentNotificationStatus,
} from "@rwa/shared";

export const toNotification = (row: NotificationRow): NotificationType => {
  const base = {
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    transactionId: row.transactionId,
    isRead: row.isRead,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  };
  if (row.likeId) return { ...base, likeId: row.likeId } as LikeNotification;
  if (row.commentId) return { ...base, commentId: row.commentId } as CommentNotification;
  return { ...base, status: row.status as PaymentNotificationStatus } as PaymentNotification;
};

export const getAllNotifications = async (): Promise<NotificationType[]> => {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toNotification);
};

export const getNotificationById = async (id: string): Promise<NotificationType | undefined> => {
  const row = await prisma.notification.findUnique({ where: { id } });
  return row ? toNotification(row) : undefined;
};

export const getNotificationsByUserId = async (userId: string): Promise<NotificationType[]> => {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toNotification);
};

// Newest first (by modifiedAt), like the API list.
export const getUnreadNotificationsByUserId = async (
  userId: string
): Promise<NotificationType[]> => {
  const rows = await prisma.notification.findMany({
    where: { userId, isRead: false },
    orderBy: [{ modifiedAt: "desc" }, { id: "asc" }],
  });
  return rows.map(toNotification);
};

const baseData = (userId: string, transactionId: string) => {
  const now = new Date();
  return {
    id: shortid(),
    uuid: v4(),
    userId,
    transactionId,
    isRead: false,
    createdAt: now,
    modifiedAt: now,
  };
};

export const createPaymentNotification = async (
  userId: string,
  transactionId: string,
  status: PaymentNotificationStatus,
  client: DbClient = prisma
): Promise<PaymentNotification> => {
  const row = await client.notification.create({
    data: { ...baseData(userId, transactionId), status },
  });
  return toNotification(row) as PaymentNotification;
};

export const createLikeNotification = async (
  userId: string,
  transactionId: string,
  likeId: string,
  client: DbClient = prisma
): Promise<LikeNotification> => {
  const row = await client.notification.create({
    data: { ...baseData(userId, transactionId), likeId },
  });
  return toNotification(row) as LikeNotification;
};

export const createCommentNotification = async (
  userId: string,
  transactionId: string,
  commentId: string,
  client: DbClient = prisma
): Promise<CommentNotification> => {
  const row = await client.notification.create({
    data: { ...baseData(userId, transactionId), commentId },
  });
  return toNotification(row) as CommentNotification;
};

// Items that do not match a known kind are skipped.
export const createNotifications = async (
  userId: string,
  notifications: NotificationPayloadType[]
): Promise<NotificationType[]> => {
  const created: NotificationType[] = [];
  for (const item of notifications) {
    if ("status" in item && item.type === NotificationsType.payment) {
      created.push(await createPaymentNotification(userId, item.transactionId, item.status));
    } else if ("likeId" in item && item.type === NotificationsType.like) {
      created.push(await createLikeNotification(userId, item.transactionId, item.likeId));
    } else if ("commentId" in item && item.type === NotificationsType.comment) {
      created.push(await createCommentNotification(userId, item.transactionId, item.commentId));
    }
  }
  return created;
};

// Only the owner can change a notification, and only isRead can be edited.
export const updateNotificationById = async (
  userId: string,
  notificationId: string,
  edits: { isRead?: boolean }
): Promise<void> => {
  if (edits.isRead === undefined) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: edits.isRead, modifiedAt: new Date() },
  });
};
