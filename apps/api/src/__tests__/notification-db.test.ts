// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../prisma";
import {
  createCommentNotification,
  createLikeNotification,
  createNotifications,
  createPaymentNotification,
  getAllNotifications,
  getNotificationById,
  getNotificationsByUserId,
  getUnreadNotificationsByUserId,
  updateNotificationById,
} from "../notification-db";
import { resetDatabase } from "./db-setup/reset";
import { NotificationsType, PaymentNotificationStatus } from "@rwa/shared";

describe("Notifications (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a payment notification with a status and no like/comment id", async () => {
    const n = await createPaymentNotification("u1", "t1", PaymentNotificationStatus.received);

    expect(n.status).toBe("received");
    expect(n.isRead).toBe(false);
    expect(n).not.toHaveProperty("likeId");
    expect(n).not.toHaveProperty("commentId");
  });

  it("creates a like notification and a comment notification", async () => {
    const like = await createLikeNotification("u1", "t1", "like1");
    const comment = await createCommentNotification("u1", "t1", "comment1");

    expect(like).toHaveProperty("likeId", "like1");
    expect(like).not.toHaveProperty("status");
    expect(comment).toHaveProperty("commentId", "comment1");
    expect(comment).not.toHaveProperty("status");
  });

  it("creates several notifications at once and skips unknown kinds", async () => {
    const created = await createNotifications("u1", [
      {
        type: NotificationsType.payment,
        transactionId: "t1",
        status: PaymentNotificationStatus.requested,
      },
      { type: NotificationsType.like, transactionId: "t2", likeId: "l1" },
      { type: NotificationsType.comment, transactionId: "t3", commentId: "c1" },
      // @ts-expect-error an unknown kind
      { type: "other", transactionId: "t4" },
    ]);

    expect(created).toHaveLength(3);
    expect(await getNotificationsByUserId("u1")).toHaveLength(3);
  });

  it("finds a notification by id and returns undefined when missing", async () => {
    const n = await createPaymentNotification("u1", "t1", PaymentNotificationStatus.received);

    expect((await getNotificationById(n.id))!.transactionId).toBe("t1");
    expect(await getNotificationById("none")).toBeUndefined();
  });

  it("lists unread notifications of one user, newest first", async () => {
    const first = await createPaymentNotification("u1", "t1", PaymentNotificationStatus.received);
    await new Promise((r) => setTimeout(r, 5));
    const second = await createPaymentNotification("u1", "t2", PaymentNotificationStatus.received);
    await createPaymentNotification("u2", "t3", PaymentNotificationStatus.received);

    const unread = await getUnreadNotificationsByUserId("u1");

    expect(unread.map((n) => n.id)).toEqual([second.id, first.id]);
  });

  it("marks a notification as read for its owner only", async () => {
    const n = await createPaymentNotification("u1", "t1", PaymentNotificationStatus.received);

    await updateNotificationById("u2", n.id, { isRead: true }); // not the owner
    expect((await getNotificationById(n.id))!.isRead).toBe(false);

    await updateNotificationById("u1", n.id, { isRead: true });
    expect((await getNotificationById(n.id))!.isRead).toBe(true);
    expect(await getUnreadNotificationsByUserId("u1")).toHaveLength(0);
  });

  it("lists every notification", async () => {
    await createPaymentNotification("u1", "t1", PaymentNotificationStatus.received);
    await createLikeNotification("u2", "t2", "l1");

    expect(await getAllNotifications()).toHaveLength(2);
  });
});
