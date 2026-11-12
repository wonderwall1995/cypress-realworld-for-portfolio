// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../prisma";
import { fundUser, createTx, accountIdOf } from "./db-setup/accounts";
import { createUser, getUserById, updateUserById } from "../user-db";
import { getBankTransferByTransactionId, getBankTransfersByUserId } from "../banktransfer-db";
import { getNotificationsByUserId } from "../notification-db";
import {
  getAllPublicTransactions,
  getAllTransactions,
  getPublicTransactionsByQuery,
  getPublicTransactionsDefaultSort,
  getTransactionById,
  getTransactionByIdForApi,
  getTransactionsForUserByObj,
  getTransactionsForUserForApi,
} from "../transaction-db";
import { resetDatabase } from "./db-setup/reset";
import { DefaultPrivacyLevel, TransactionPayload } from "@rwa/shared";

const makeUser = async (n: number, balance = 0, avatar?: string) => {
  const user = await createUser({
    firstName: `First${n}`,
    lastName: `Last${n}`,
    username: `user${n}`,
    password: "s3cret",
    avatar,
    defaultPrivacyLevel: DefaultPrivacyLevel.public,
  });
  await fundUser(user.id, balance);
  return user;
};

const details = (receiverId: string, amountDollars: number, privacyLevel = "public") =>
  ({
    source: "acct1",
    receiverId,
    description: "test",
    amount: amountDollars,
    privacyLevel,
  }) as unknown as TransactionPayload;

const balanceOf = async (id: string) => (await getUserById(id))!.balance;

describe("Transactions (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("create a payment", () => {
    it("completes it, moves the money and notifies the receiver", async () => {
      const sender = await makeUser(1, 10000);
      const receiver = await makeUser(2, 500);

      const tx = await createTx(sender.id, "payment", details(receiver.id, 20));

      expect(tx.id).toBeDefined();
      expect(tx.status).toBe("complete");
      expect(tx.requestStatus).toBeUndefined();
      expect(tx.amount).toBe(2000);
      expect(await balanceOf(sender.id)).toBe(8000);
      expect(await balanceOf(receiver.id)).toBe(2500);
      expect(await getBankTransferByTransactionId(tx.id)).toBeUndefined();

      const notes = await getNotificationsByUserId(receiver.id);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({ status: "received", transactionId: tx.id });
    });

    it("refuses a payment the chosen bank account cannot cover (400) and changes nothing", async () => {
      const sender = await makeUser(1, 1000);
      const receiver = await makeUser(2, 0);

      await expect(createTx(sender.id, "payment", details(receiver.id, 15))).rejects.toMatchObject({
        status: 400,
      });

      expect(await balanceOf(sender.id)).toBe(1000);
      expect(await balanceOf(receiver.id)).toBe(0);
      expect(await getAllTransactions()).toHaveLength(0);
      expect(await prisma.notification.count()).toBe(0);
    });

    it("moves the money between the two chosen accounts and remembers the balances after", async () => {
      const sender = await makeUser(1, 10000);
      const receiver = await makeUser(2, 500);

      const tx = await createTx(sender.id, "payment", details(receiver.id, 20));

      const row = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
      expect(row.payerAccountId).toBe(accountIdOf(sender.id));
      expect(row.payeeAccountId).toBe(accountIdOf(receiver.id));
      expect(row.payerBalanceAfter).toBe(8000);
      expect(row.payeeBalanceAfter).toBe(2500);
    });

    it("uses the sender's default privacy level when none is given", async () => {
      const sender = await makeUser(1, 10000);
      const receiver = await makeUser(2);
      const payload = details(receiver.id, 5) as any;
      delete payload.privacyLevel;

      const tx = await createTx(sender.id, "payment", payload);

      expect(tx.privacyLevel).toBe("public");
    });

    it("saves nothing when the receiver does not exist", async () => {
      const sender = await makeUser(1, 10000);

      await expect(createTx(sender.id, "payment", details("nobody", 5))).rejects.toThrow();

      expect(await getAllTransactions()).toHaveLength(0);
      expect(await balanceOf(sender.id)).toBe(10000);
    });
  });

  describe("requests are gone", () => {
    it("a request cannot be created: nothing saved, nobody notified", async () => {
      const requester = await makeUser(1, 100);
      const payer = await makeUser(2, 5000);

      await expect(
        createTx(requester.id, "request" as any, details(payer.id, 10))
      ).rejects.toMatchObject({ status: 400 });

      expect(await getAllTransactions()).toHaveLength(0);
      expect(await getNotificationsByUserId(payer.id)).toHaveLength(0);
      expect(await balanceOf(requester.id)).toBe(100);
      expect(await balanceOf(payer.id)).toBe(5000);
    });
  });

  describe("lists for a user", () => {
    it("finds transactions where the user is the receiver or the sender, without duplicates", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2, 100000);
      const c = await makeUser(3, 100000);
      const sent = await createTx(a.id, "payment", details(b.id, 5));
      const received = await createTx(b.id, "payment", details(a.id, 6));
      await createTx(b.id, "payment", details(c.id, 7));

      const list = await getTransactionsForUserByObj(a.id);

      expect(list.map((t) => t.id).sort()).toEqual([sent.id, received.id].sort());
    });

    it("filters by status and request status (an old request row can still be read)", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2, 100000);
      await createTx(a.id, "payment", details(b.id, 5));
      // requests cannot be made any more, but rows made earlier are still in the database
      const now = new Date();
      const old = await prisma.transaction.create({
        data: {
          id: "oldreq1",
          uuid: "oldreq1-uuid",
          source: "",
          amount: 600,
          description: "old",
          receiverId: b.id,
          senderId: a.id,
          privacyLevel: "public",
          status: "pending",
          requestStatus: "pending",
          requestResolvedAt: "",
          createdAt: now,
          modifiedAt: now,
        },
      });

      const complete = await getTransactionsForUserByObj(a.id, { status: "complete" });
      const pending = await getTransactionsForUserByObj(a.id, { requestStatus: "pending" });

      expect(complete).toHaveLength(1);
      expect(pending.map((t) => t.id)).toEqual([old.id]);
      expect(await getTransactionsForUserByObj(a.id, { status: "invalid" })).toEqual([]);
    });

    it("filters by date range", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2, 100000);
      const old = await createTx(a.id, "payment", details(b.id, 5));
      await prisma.transaction.update({
        where: { id: old.id },
        data: { createdAt: new Date("2023-03-10T00:00:00Z") },
      });
      await createTx(a.id, "payment", details(b.id, 6));

      const list = await getTransactionsForUserByObj(a.id, {
        dateRangeStart: new Date("2023-03-09T00:00:00Z"),
        dateRangeEnd: new Date("2023-03-11T00:00:00Z"),
      });

      expect(list.map((t) => t.id)).toEqual([old.id]);
    });

    it("adds names, avatars, likes and comments, newest first, for the API", async () => {
      const a = await makeUser(1, 100000, "https://avatar/a.svg");
      const b = await makeUser(2, 100000);
      const first = await createTx(a.id, "payment", details(b.id, 5));
      await prisma.transaction.update({
        where: { id: first.id },
        data: { modifiedAt: new Date("2020-01-01T00:00:00Z") },
      });
      const second = await createTx(a.id, "payment", details(b.id, 6));

      const list = await getTransactionsForUserForApi(a.id);

      expect(list.map((t) => t.id)).toEqual([second.id, first.id]);
      expect(list[0].senderName).toBe("Last1 First1");
      expect(list[0].receiverName).toBe("Last2 First2");
      expect(list[0].senderAvatar).toBe("https://avatar/a.svg");
      expect(list[0].receiverAvatar).toBeUndefined();
      expect(list[0].likes).toEqual([]);
      expect(list[0].comments).toEqual([]);
    });

    it("gets one transaction for the API, or undefined when missing", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2);
      const tx = await createTx(a.id, "payment", details(b.id, 5));

      expect((await getTransactionByIdForApi(tx.id))!.senderName).toBe("Last1 First1");
      expect(await getTransactionByIdForApi("nope")).toBeUndefined();
    });
  });

  describe("the public feed", () => {
    it("lists every public transaction and no private or old 'contacts' one", async () => {
      const me = await makeUser(1, 100000);
      const a = await makeUser(2, 100000);
      const b = await makeUser(3, 100000);

      const pub = await createTx(a.id, "payment", details(b.id, 5));
      const priv = await createTx(a.id, "payment", details(b.id, 6, "private"));
      const old = await createTx(a.id, "payment", details(b.id, 7, "contacts"));

      const feed = (await getPublicTransactionsDefaultSort(me.id)).map((t) => t.id);

      expect(feed).toEqual([pub.id]);
      expect(feed).not.toContain(priv.id);
      expect(feed).not.toContain(old.id);
      expect((await getAllPublicTransactions()).length).toBe(1);
    });

    it("is empty when there is nothing public", async () => {
      const me = await makeUser(1);

      expect(await getPublicTransactionsDefaultSort(me.id)).toEqual([]);
    });

    it("still shows a private transaction to the member who is in it (own list)", async () => {
      const me = await makeUser(1, 100000);
      const other = await makeUser(2, 100000);

      const priv = await createTx(other.id, "payment", details(me.id, 1, "private"));

      expect((await getTransactionsForUserForApi(me.id)).map((t) => t.id)).toContain(priv.id);
    });
  });

  describe("list scope", () => {
    it("ignores receiverId and senderId in the query: the list is always about the given user", async () => {
      const me = await makeUser(1, 100000);
      const a = await makeUser(2, 100000);
      const b = await makeUser(3, 100000);
      await createTx(a.id, "payment", details(b.id, 5, "private"));

      const result = await getTransactionsForUserForApi(me.id, {
        receiverId: b.id,
        senderId: a.id,
      });

      expect(result).toEqual([]);
    });
  });
});
