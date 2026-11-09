// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../../backend/prisma";
import { createUser } from "../../backend/user-db";
import { createTransaction } from "../../backend/transaction-db";
import { createComments, createLikes } from "../../backend/social-db";
import { getLikesByTransactionId } from "../../backend/like-db";
import { getCommentsByTransactionId } from "../../backend/comment-db";
import { getNotificationsByUserId } from "../../backend/notification-db";
import {
  formatNotificationsForApiResponse,
  getUnreadNotificationsForApi,
} from "../../backend/notification-api";
import { resetDatabase } from "./db-setup/reset";
import { TransactionPayload } from "../models";

const makeUser = (n: number) =>
  createUser({
    firstName: `First${n}`,
    lastName: `Last${n}`,
    username: `user${n}`,
    password: "s3cret",
  });

const payload = (receiverId: string, amount = 5) =>
  ({
    source: "acct1",
    receiverId,
    description: "t",
    amount,
    privacyLevel: "public",
  }) as unknown as TransactionPayload;

describe("Likes, comments and notifications (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a like notifies the sender and the receiver of the transaction", async () => {
    const [sender, receiver, fan] = [await makeUser(1), await makeUser(2), await makeUser(3)];
    const tx = await createTransaction(sender.id, "payment", payload(receiver.id));

    const like = await createLikes(fan.id, tx.id);

    expect(await getLikesByTransactionId(tx.id)).toHaveLength(1);
    const forSender = (await getNotificationsByUserId(sender.id)).filter((n: any) => n.likeId);
    const forReceiver = (await getNotificationsByUserId(receiver.id)).filter((n: any) => n.likeId);
    expect(forSender).toHaveLength(1);
    expect(forReceiver).toHaveLength(1);
    expect(forSender[0]).toHaveProperty("likeId", like.id);
  });

  it("a comment notifies the sender and the receiver of the transaction", async () => {
    const [sender, receiver, other] = [await makeUser(1), await makeUser(2), await makeUser(3)];
    const tx = await createTransaction(sender.id, "payment", payload(receiver.id));

    const comment = await createComments(other.id, tx.id, "nice");

    expect((await getCommentsByTransactionId(tx.id))[0].content).toBe("nice");
    const forSender = (await getNotificationsByUserId(sender.id)).filter((n: any) => n.commentId);
    const forReceiver = (await getNotificationsByUserId(receiver.id)).filter(
      (n: any) => n.commentId
    );
    expect(forSender).toHaveLength(1);
    expect(forReceiver).toHaveLength(1);
    expect(forReceiver[0]).toHaveProperty("commentId", comment.id);
  });

  it("saves nothing for a transaction that does not exist", async () => {
    const user = await makeUser(1);

    await expect(createLikes(user.id, "nope")).rejects.toThrow(/not found/);
    await expect(createComments(user.id, "nope", "x")).rejects.toThrow(/not found/);

    expect(await prisma.like.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  describe("notification list for the API", () => {
    it("shows the name of the person the notification is about, newest first", async () => {
      const [requester, payer, fan] = [await makeUser(1), await makeUser(2), await makeUser(3)];
      const request = await createTransaction(requester.id, "request", payload(payer.id));
      await new Promise((r) => setTimeout(r, 5));
      await createLikes(fan.id, request.id);
      await new Promise((r) => setTimeout(r, 5));
      await createComments(fan.id, request.id, "hello");

      const list = await getUnreadNotificationsForApi(payer.id);

      // newest first: comment, like, then the original request notification
      expect(list).toHaveLength(3);
      expect(list[0]).toHaveProperty("commentId");
      expect(list[0].userFullName).toBe("First3 Last3"); // who commented
      expect(list[1]).toHaveProperty("likeId");
      expect(list[1].userFullName).toBe("First3 Last3"); // who liked
      expect(list[2]).toHaveProperty("status", "requested");
      expect(list[2].userFullName).toBe("First1 Last1"); // sender of the request
    });

    it("shows the receiver's own name for a received payment", async () => {
      const [sender, receiver] = [await makeUser(1), await makeUser(2)];
      await createTransaction(sender.id, "payment", payload(receiver.id));

      const list = await getUnreadNotificationsForApi(receiver.id);

      expect(list[0].userFullName).toBe("First2 Last2");
    });

    it("returns an empty list when there is nothing to show", async () => {
      expect(await formatNotificationsForApiResponse([])).toEqual([]);
      expect(await getUnreadNotificationsForApi("nobody")).toEqual([]);
    });
  });
});
