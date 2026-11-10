// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../prisma";
import { createUser, getUserById, updateUserById } from "../user-db";
import { createContactForUser } from "../contact-db";
import { getBankTransferByTransactionId, getBankTransfersByUserId } from "../banktransfer-db";
import { getNotificationsByUserId } from "../notification-db";
import {
  createTransaction,
  getAllPublicTransactions,
  getAllTransactions,
  getPublicTransactionsByQuery,
  getPublicTransactionsDefaultSort,
  getTransactionById,
  getTransactionByIdForApi,
  getTransactionsForUserByObj,
  getTransactionsForUserContacts,
  getTransactionsForUserForApi,
  updateTransactionById,
} from "../transaction-db";
import { resetDatabase } from "./db-setup/reset";
import { DefaultPrivacyLevel, TransactionPayload, TransactionRequestStatus } from "@rwa/shared";

const makeUser = async (n: number, balance = 0, avatar?: string) => {
  const user = await createUser({
    firstName: `First${n}`,
    lastName: `Last${n}`,
    username: `user${n}`,
    password: "s3cret",
    avatar,
    defaultPrivacyLevel: DefaultPrivacyLevel.public,
  });
  if (balance) await updateUserById(user.id, { balance });
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

      const tx = await createTransaction(sender.id, "payment", details(receiver.id, 20));

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

    it("takes the missing part from the bank account when the balance is not enough", async () => {
      const sender = await makeUser(1, 1000);
      const receiver = await makeUser(2, 0);

      const tx = await createTransaction(sender.id, "payment", details(receiver.id, 15));

      expect(await balanceOf(sender.id)).toBe(0);
      expect(await balanceOf(receiver.id)).toBe(1500);

      const withdrawal = await getBankTransferByTransactionId(tx.id);
      expect(withdrawal).toBeDefined();
      expect(withdrawal!.type).toBe("withdrawal");
      expect(withdrawal!.amount).toBe(500);
      expect(withdrawal!.status).toBe("completed");
      expect(withdrawal!.userId).toBe(sender.id);
      expect(withdrawal!.source).toBe("acct1");
      expect(await getBankTransfersByUserId(sender.id)).toHaveLength(1);
    });

    it("uses the sender's default privacy level when none is given", async () => {
      const sender = await makeUser(1, 10000);
      const receiver = await makeUser(2);
      const payload = details(receiver.id, 5) as any;
      delete payload.privacyLevel;

      const tx = await createTransaction(sender.id, "payment", payload);

      expect(tx.privacyLevel).toBe("public");
    });

    it("saves nothing when the receiver does not exist", async () => {
      const sender = await makeUser(1, 10000);

      await expect(createTransaction(sender.id, "payment", details("nobody", 5))).rejects.toThrow();

      expect(await getAllTransactions()).toHaveLength(0);
      expect(await balanceOf(sender.id)).toBe(10000);
    });
  });

  describe("create a request", () => {
    it("stays pending, changes no balance and notifies the receiver", async () => {
      const requester = await makeUser(1, 100);
      const payer = await makeUser(2, 5000);

      const tx = await createTransaction(requester.id, "request", details(payer.id, 10));

      expect(tx.status).toBe("pending");
      expect(tx.requestStatus).toBe("pending");
      expect(await balanceOf(requester.id)).toBe(100);
      expect(await balanceOf(payer.id)).toBe(5000);

      const notes = await getNotificationsByUserId(payer.id);
      expect(notes[0]).toMatchObject({ status: "requested", transactionId: tx.id });
    });
  });

  describe("update (accept / reject a request)", () => {
    it("accepting a request: the receiver pays the sender, it completes, the sender is notified", async () => {
      const requester = await makeUser(1, 100);
      const payer = await makeUser(2, 5000);
      const tx = await createTransaction(requester.id, "request", details(payer.id, 10));

      await updateTransactionById(tx.id, { requestStatus: TransactionRequestStatus.accepted });

      const updated = (await getTransactionById(tx.id))!;
      expect(updated.requestStatus).toBe("accepted");
      expect(updated.status).toBe("complete");
      expect(await balanceOf(payer.id)).toBe(4000);
      expect(await balanceOf(requester.id)).toBe(1100);

      const notes = await getNotificationsByUserId(requester.id);
      expect(notes[0]).toMatchObject({ status: "received", transactionId: tx.id });
    });

    it("rejecting a request moves no money, keeps it pending and sends no notification", async () => {
      const requester = await makeUser(1, 100);
      const payer = await makeUser(2, 5000);
      const tx = await createTransaction(requester.id, "request", details(payer.id, 10));

      await updateTransactionById(tx.id, { requestStatus: TransactionRequestStatus.rejected });

      const updated = (await getTransactionById(tx.id))!;
      expect(updated.requestStatus).toBe("rejected");
      expect(updated.status).toBe("pending");
      expect(await balanceOf(payer.id)).toBe(5000);
      expect(await balanceOf(requester.id)).toBe(100);
      expect(await getNotificationsByUserId(requester.id)).toHaveLength(0);
    });

    it("a request that was accepted cannot be accepted again (money moves only once)", async () => {
      const requester = await makeUser(1, 100);
      const payer = await makeUser(2, 5000);
      const tx = await createTransaction(requester.id, "request", details(payer.id, 10));

      await updateTransactionById(tx.id, { requestStatus: TransactionRequestStatus.accepted });
      await expect(
        updateTransactionById(tx.id, { requestStatus: TransactionRequestStatus.accepted })
      ).rejects.toMatchObject({ status: 409 });

      expect(await balanceOf(payer.id)).toBe(4000);
      expect(await balanceOf(requester.id)).toBe(1100);
      expect(await getNotificationsByUserId(requester.id)).toHaveLength(1);
    });

    it("a rejected request cannot be accepted later, and an accepted one cannot be rejected", async () => {
      const requester = await makeUser(1, 100);
      const payer = await makeUser(2, 5000);
      const rejected = await createTransaction(requester.id, "request", details(payer.id, 10));
      const accepted = await createTransaction(requester.id, "request", details(payer.id, 20));

      await updateTransactionById(rejected.id, {
        requestStatus: TransactionRequestStatus.rejected,
      });
      await updateTransactionById(accepted.id, {
        requestStatus: TransactionRequestStatus.accepted,
      });

      await expect(
        updateTransactionById(rejected.id, { requestStatus: TransactionRequestStatus.accepted })
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        updateTransactionById(accepted.id, { requestStatus: TransactionRequestStatus.rejected })
      ).rejects.toMatchObject({ status: 409 });

      // only the $20 request moved money
      expect(await balanceOf(payer.id)).toBe(3000);
      expect(await balanceOf(requester.id)).toBe(2100);
      expect((await getTransactionById(rejected.id))!.requestStatus).toBe("rejected");
      expect((await getTransactionById(accepted.id))!.requestStatus).toBe("accepted");
    });

    it("updating a payment only changes the edited field", async () => {
      const sender = await makeUser(1, 10000);
      const receiver = await makeUser(2);
      const tx = await createTransaction(sender.id, "payment", details(receiver.id, 5));
      const before = await balanceOf(sender.id);

      await updateTransactionById(tx.id, { requestStatus: TransactionRequestStatus.rejected });

      expect((await getTransactionById(tx.id))!.requestStatus).toBe("rejected");
      expect(await balanceOf(sender.id)).toBe(before);
    });

    it("ignores fields that cannot be edited", async () => {
      const sender = await makeUser(1, 10000);
      const receiver = await makeUser(2);
      const tx = await createTransaction(sender.id, "payment", details(receiver.id, 5));

      await updateTransactionById(tx.id, { amount: 1, senderId: "x" } as any);

      const after = (await getTransactionById(tx.id))!;
      expect(after.amount).toBe(500);
      expect(after.senderId).toBe(sender.id);
    });

    it("fails for an unknown transaction", async () => {
      await expect(updateTransactionById("nope", {})).rejects.toThrow(/not found/);
    });
  });

  describe("lists for a user", () => {
    it("finds transactions where the user is the receiver or the sender, without duplicates", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2, 100000);
      const c = await makeUser(3, 100000);
      const sent = await createTransaction(a.id, "payment", details(b.id, 5));
      const received = await createTransaction(b.id, "payment", details(a.id, 6));
      await createTransaction(b.id, "payment", details(c.id, 7));

      const list = await getTransactionsForUserByObj(a.id);

      expect(list.map((t) => t.id).sort()).toEqual([sent.id, received.id].sort());
    });

    it("filters by status and request status", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2, 100000);
      await createTransaction(a.id, "payment", details(b.id, 5));
      const request = await createTransaction(a.id, "request", details(b.id, 6));

      const complete = await getTransactionsForUserByObj(a.id, { status: "complete" });
      const pending = await getTransactionsForUserByObj(a.id, { requestStatus: "pending" });

      expect(complete).toHaveLength(1);
      expect(pending.map((t) => t.id)).toEqual([request.id]);
      expect(await getTransactionsForUserByObj(a.id, { status: "invalid" })).toEqual([]);
    });

    it("filters by date range", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2, 100000);
      const old = await createTransaction(a.id, "payment", details(b.id, 5));
      await prisma.transaction.update({
        where: { id: old.id },
        data: { createdAt: new Date("2023-03-10T00:00:00Z") },
      });
      await createTransaction(a.id, "payment", details(b.id, 6));

      const list = await getTransactionsForUserByObj(a.id, {
        dateRangeStart: new Date("2023-03-09T00:00:00Z"),
        dateRangeEnd: new Date("2023-03-11T00:00:00Z"),
      });

      expect(list.map((t) => t.id)).toEqual([old.id]);
    });

    it("adds names, avatars, likes and comments, newest first, for the API", async () => {
      const a = await makeUser(1, 100000, "https://avatar/a.svg");
      const b = await makeUser(2, 100000);
      const first = await createTransaction(a.id, "payment", details(b.id, 5));
      await prisma.transaction.update({
        where: { id: first.id },
        data: { modifiedAt: new Date("2020-01-01T00:00:00Z") },
      });
      const second = await createTransaction(a.id, "payment", details(b.id, 6));

      const list = await getTransactionsForUserForApi(a.id);

      expect(list.map((t) => t.id)).toEqual([second.id, first.id]);
      expect(list[0].senderName).toBe("First1 Last1");
      expect(list[0].receiverName).toBe("First2 Last2");
      expect(list[0].senderAvatar).toBe("https://avatar/a.svg");
      expect(list[0].receiverAvatar).toBeUndefined();
      expect(list[0].likes).toEqual([]);
      expect(list[0].comments).toEqual([]);
    });

    it("gets one transaction for the API, or undefined when missing", async () => {
      const a = await makeUser(1, 100000);
      const b = await makeUser(2);
      const tx = await createTransaction(a.id, "payment", details(b.id, 5));

      expect((await getTransactionByIdForApi(tx.id))!.senderName).toBe("First1 Last1");
      expect(await getTransactionByIdForApi("nope")).toBeUndefined();
    });
  });

  describe("contacts and public feeds", () => {
    it("lists the contacts' transactions and keeps them out of the other public list", async () => {
      const me = await makeUser(1, 100000);
      const friend = await makeUser(2, 100000);
      const stranger1 = await makeUser(3, 100000);
      const stranger2 = await makeUser(4, 100000);
      await createContactForUser(me.id, friend.id);

      const friendTx = await createTransaction(friend.id, "payment", details(stranger1.id, 5));
      const strangerTx = await createTransaction(stranger1.id, "payment", details(stranger2.id, 6));
      const privateTx = await createTransaction(
        stranger1.id,
        "payment",
        details(stranger2.id, 7, "private")
      );

      const contacts = await getTransactionsForUserContacts(me.id);
      const { contactsTransactions, publicTransactions } = await getPublicTransactionsDefaultSort(
        me.id
      );

      expect(contacts.map((t) => t.id)).toEqual([friendTx.id]);
      expect(contactsTransactions.map((t) => t.id)).toEqual([friendTx.id]);
      expect(publicTransactions.map((t) => t.id)).toEqual([strangerTx.id]);
      expect(publicTransactions.map((t) => t.id)).not.toContain(privateTx.id);
      expect((await getAllPublicTransactions()).length).toBe(2);
    });

    it("returns empty lists when there are no contacts", async () => {
      const me = await makeUser(1);

      expect(await getTransactionsForUserContacts(me.id)).toEqual([]);
    });

    it("keeps a contact's private transactions out of both feeds, but shows the other levels", async () => {
      const me = await makeUser(1, 100000);
      const friend = await makeUser(2, 100000);
      const other = await makeUser(3, 100000);
      await createContactForUser(me.id, friend.id);

      const priv = await createTransaction(friend.id, "payment", details(other.id, 1, "private"));
      const withContacts = await createTransaction(
        friend.id,
        "payment",
        details(other.id, 2, "contacts")
      );
      const pub = await createTransaction(friend.id, "payment", details(other.id, 3, "public"));

      const friends = (await getTransactionsForUserContacts(me.id)).map((t) => t.id);
      const everyone = await getPublicTransactionsDefaultSort(me.id);

      expect(friends).toEqual(expect.arrayContaining([withContacts.id, pub.id]));
      expect(friends).not.toContain(priv.id);
      expect(everyone.contactsTransactions.map((t) => t.id)).not.toContain(priv.id);
      expect(everyone.publicTransactions.map((t) => t.id)).not.toContain(priv.id);
    });

    it("still shows a private transaction to the member who is in it", async () => {
      const me = await makeUser(1, 100000);
      const friend = await makeUser(2, 100000);
      await createContactForUser(me.id, friend.id);

      const priv = await createTransaction(friend.id, "payment", details(me.id, 1, "private"));

      // I am the receiver, so it is mine to see (also through the friend's list)
      expect((await getTransactionsForUserContacts(me.id)).map((t) => t.id)).toContain(priv.id);
      expect((await getTransactionsForUserForApi(me.id)).map((t) => t.id)).toContain(priv.id);
    });
  });

  describe("list scope", () => {
    it("ignores receiverId and senderId in the query: the list is always about the given user", async () => {
      const me = await makeUser(1, 100000);
      const a = await makeUser(2, 100000);
      const b = await makeUser(3, 100000);
      await createTransaction(a.id, "payment", details(b.id, 5, "private"));

      const result = await getTransactionsForUserForApi(me.id, {
        receiverId: b.id,
        senderId: a.id,
      });

      expect(result).toEqual([]);
    });
  });
});
