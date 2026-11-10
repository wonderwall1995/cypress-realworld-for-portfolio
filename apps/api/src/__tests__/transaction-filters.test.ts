// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { validationResult } from "express-validator";
import { DefaultPrivacyLevel, TransactionPayload, TransactionRequestStatus } from "@rwa/shared";
import prisma from "../prisma";
import { createUser, updateUserById } from "../user-db";
import { createContactForUser } from "../contact-db";
import {
  createTransaction,
  getPublicTransactionsByQuery,
  getTransactionsForUserByObj,
  getTransactionsForUserContacts,
  getTransactionsForUserForApi,
  updateTransactionById,
} from "../transaction-db";
import { transactionFilterValidators } from "../validators";
import { resetDatabase } from "./db-setup/reset";

const makeUser = async (name: string, balance = 1_000_000) => {
  const user = await createUser({
    firstName: name,
    lastName: "Test",
    username: name.toLowerCase(),
    password: "s3cret",
    defaultPrivacyLevel: DefaultPrivacyLevel.public,
  });
  await updateUserById(user.id, { balance });
  return user;
};

const details = (receiverId: string, dollars: number) =>
  ({
    source: "acct1",
    receiverId,
    description: "t",
    amount: dollars,
    privacyLevel: "public",
  }) as unknown as TransactionPayload;

const ids = (list: { id: string }[]) => list.map((t) => t.id).sort();

describe("deposit / withdrawal filters and date range (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // me has:  in $100, in $250, out $100, out $30, an accepted request I made ($40, in),
  //          and a pending request someone made to me ($60, no money moved)
  const world = async () => {
    const me = await makeUser("Me");
    const other = await makeUser("Other");
    const friend = await makeUser("Friend");
    const stranger = await makeUser("Stranger");
    await createContactForUser(me.id, friend.id);

    const in100 = await createTransaction(other.id, "payment", details(me.id, 100));
    const in250 = await createTransaction(other.id, "payment", details(me.id, 250));
    const out100 = await createTransaction(me.id, "payment", details(other.id, 100));
    const out30 = await createTransaction(me.id, "payment", details(other.id, 30));
    const req40 = await createTransaction(me.id, "request", details(other.id, 40));
    await updateTransactionById(req40.id, { requestStatus: TransactionRequestStatus.accepted });
    const pending60 = await createTransaction(other.id, "request", details(me.id, 60));
    const friendToMe = await createTransaction(friend.id, "payment", details(me.id, 20));
    const friendToStranger = await createTransaction(
      friend.id,
      "payment",
      details(stranger.id, 75)
    );
    const strangerToOther = await createTransaction(stranger.id, "payment", details(other.id, 90));
    return {
      me,
      other,
      friend,
      stranger,
      in100,
      in250,
      out100,
      out30,
      req40,
      pending60,
      friendToMe,
      friendToStranger,
      strangerToOther,
    };
  };

  describe("personal list (my transactions)", () => {
    it("deposit box only: money I received inside the range, both ends included", async () => {
      const w = await world();

      const exact = await getTransactionsForUserByObj(w.me.id, {
        depositMin: 10000,
        depositMax: 10000,
      });
      expect(ids(exact)).toEqual(ids([w.in100]));

      const wide = await getTransactionsForUserByObj(w.me.id, { depositMin: 0, depositMax: 30000 });
      // in100, in250, the accepted request I made ($40, I received it) and the $20 from my friend
      expect(ids(wide)).toEqual(ids([w.in100, w.in250, w.req40, w.friendToMe]));
    });

    it("edge case: 100 ~ 100 finds only the $100 transactions", async () => {
      const w = await world();

      const out = await getTransactionsForUserByObj(w.me.id, {
        withdrawalMin: 10000,
        withdrawalMax: 10000,
      });

      expect(ids(out)).toEqual(ids([w.out100]));
    });

    it("withdrawal box only: money I paid, never money I received", async () => {
      const w = await world();

      const out = await getTransactionsForUserByObj(w.me.id, {
        withdrawalMin: 0,
        withdrawalMax: 5000,
      });

      expect(ids(out)).toEqual(ids([w.out30]));
    });

    it("both boxes: either one matches", async () => {
      const w = await world();

      const both = await getTransactionsForUserByObj(w.me.id, {
        depositMin: 25000,
        depositMax: 25000,
        withdrawalMin: 3000,
        withdrawalMax: 3000,
      });

      expect(ids(both)).toEqual(ids([w.in250, w.out30]));
    });

    it("an empty maximum means no upper limit", async () => {
      const w = await world();

      const list = await getTransactionsForUserByObj(w.me.id, { depositMin: 10000 });

      expect(ids(list)).toEqual(ids([w.in100, w.in250]));
    });

    it("a pending request moved no money, so it never shows up in a deposit or withdrawal filter", async () => {
      const w = await world();

      const all = await getTransactionsForUserByObj(w.me.id, { depositMin: 0, withdrawalMin: 0 });

      expect(ids(all)).not.toContain(w.pending60.id);
      expect(ids(all)).toEqual(ids([w.in100, w.in250, w.out100, w.out30, w.req40, w.friendToMe]));
    });

    it("no filter: everything of mine, including the pending request", async () => {
      const w = await world();

      const all = await getTransactionsForUserByObj(w.me.id, {});

      expect(ids(all)).toEqual(
        ids([w.in100, w.in250, w.out100, w.out30, w.req40, w.pending60, w.friendToMe])
      );
    });

    it("refuses a minimum above its maximum (400) but accepts equal numbers", async () => {
      const w = await world();

      await expect(
        getTransactionsForUserByObj(w.me.id, { depositMin: 100000, depositMax: 10000 })
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        getTransactionsForUserByObj(w.me.id, { withdrawalMin: 5001, withdrawalMax: 5000 })
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        getTransactionsForUserByObj(w.me.id, { depositMin: 10000, depositMax: 10000 })
      ).resolves.toBeDefined();
    });

    it("works through the API-shaped list too", async () => {
      const w = await world();

      const list = await getTransactionsForUserForApi(w.me.id, {
        withdrawalMin: 10000,
        withdrawalMax: 10000,
      });

      expect(ids(list)).toEqual(ids([w.out100]));
      expect(list[0].senderName).toBe("Me Test");
    });
  });

  describe("friends and everyone lists use MY deposits and withdrawals", () => {
    it("friends list: the filter looks at me, not at the friend", async () => {
      const w = await world();

      // the friend paid ME $20: that is a deposit for me, although it is the friend's withdrawal
      const deposits = await getTransactionsForUserContacts(w.me.id, {
        depositMin: 2000,
        depositMax: 2000,
      });
      expect(ids(deposits)).toEqual(ids([w.friendToMe]));

      const withdrawals = await getTransactionsForUserContacts(w.me.id, { withdrawalMin: 0 });
      expect(ids(withdrawals)).toEqual([]); // the friend's other payments are not mine
    });

    it("friends list: transactions between other people drop out once a filter is set", async () => {
      const w = await world();

      const plain = await getTransactionsForUserContacts(w.me.id, {});
      expect(ids(plain)).toEqual(ids([w.friendToMe, w.friendToStranger]));

      const filtered = await getTransactionsForUserContacts(w.me.id, {
        depositMin: 0,
        withdrawalMin: 0,
      });
      expect(ids(filtered)).toEqual(ids([w.friendToMe]));
    });

    it("everyone list: same rule for the public part and for the friends part", async () => {
      const w = await world();

      const result = await getPublicTransactionsByQuery(w.me.id, {
        depositMin: 0,
        withdrawalMin: 0,
      } as any);

      const shown = ids([...result.contactsTransactions, ...result.publicTransactions]);
      expect(shown).toEqual(ids([w.in100, w.in250, w.out100, w.out30, w.req40, w.friendToMe]));
      expect(shown).not.toContain(w.strangerToOther.id);
      expect(shown).not.toContain(w.friendToStranger.id);
    });

    it("everyone list: 100 ~ 100 deposit finds only my $100", async () => {
      const w = await world();

      const result = await getPublicTransactionsByQuery(w.me.id, {
        depositMin: 10000,
        depositMax: 10000,
      } as any);

      expect(ids([...result.contactsTransactions, ...result.publicTransactions])).toEqual(
        ids([w.in100])
      );
    });
  });

  describe("date range", () => {
    const at = async (id: string, createdAt: Date) =>
      prisma.transaction.update({ where: { id }, data: { createdAt } });

    it("edge case: the same start and end day finds that whole day and nothing else", async () => {
      const me = await makeUser("Me");
      const other = await makeUser("Other");
      const tx = async () => (await createTransaction(me.id, "payment", details(other.id, 5))).id;
      const dayStart = await tx();
      const noon = await tx();
      const dayEnd = await tx();
      const justBefore = await tx();
      const justAfter = await tx();
      await at(dayStart, new Date(2026, 2, 10, 0, 0, 0, 0));
      await at(noon, new Date(2026, 2, 10, 12, 0, 0, 0));
      await at(dayEnd, new Date(2026, 2, 10, 23, 59, 59, 999));
      await at(justBefore, new Date(2026, 2, 9, 23, 59, 59, 999));
      await at(justAfter, new Date(2026, 2, 11, 0, 0, 0, 0));

      const list = await getTransactionsForUserByObj(me.id, {
        dateRangeStart: new Date(2026, 2, 10, 0, 0, 0, 0).toISOString(),
        dateRangeEnd: new Date(2026, 2, 10, 23, 59, 59, 999).toISOString(),
      });

      expect(ids(list)).toEqual([dayStart, noon, dayEnd].sort());
    });

    it("refuses a start after the end (400)", async () => {
      const me = await makeUser("Me");

      await expect(
        getTransactionsForUserByObj(me.id, {
          dateRangeStart: new Date(2026, 2, 11).toISOString(),
          dateRangeEnd: new Date(2026, 2, 10).toISOString(),
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it("only a start finds that day and later, only an end finds that day and earlier", async () => {
      const me = await makeUser("Me");
      const other = await makeUser("Other");
      const tx = async () => (await createTransaction(me.id, "payment", details(other.id, 5))).id;
      const early = await tx();
      const middle = await tx();
      const late = await tx();
      await at(early, new Date(2026, 2, 5, 12));
      await at(middle, new Date(2026, 2, 10, 12));
      await at(late, new Date(2026, 2, 20, 12));

      const from = await getTransactionsForUserByObj(me.id, {
        dateRangeStart: new Date(2026, 2, 10, 0, 0, 0, 0).toISOString(),
      });
      const upTo = await getTransactionsForUserByObj(me.id, {
        dateRangeEnd: new Date(2026, 2, 10, 23, 59, 59, 999).toISOString(),
      });

      expect(ids(from)).toEqual([middle, late].sort());
      expect(ids(upTo)).toEqual([early, middle].sort());
    });

    it("date range and deposit filter work together", async () => {
      const me = await makeUser("Me");
      const other = await makeUser("Other");
      const oldOne = await createTransaction(other.id, "payment", details(me.id, 100));
      const newOne = await createTransaction(other.id, "payment", details(me.id, 100));
      await at(oldOne.id, new Date(2026, 0, 5, 12));
      await at(newOne.id, new Date(2026, 2, 10, 12));

      const list = await getTransactionsForUserByObj(me.id, {
        dateRangeStart: new Date(2026, 2, 1).toISOString(),
        dateRangeEnd: new Date(2026, 2, 31, 23, 59, 59, 999).toISOString(),
        depositMin: 10000,
        depositMax: 10000,
      });

      expect(ids(list)).toEqual([newOne.id]);
    });
  });

  describe("query validators (the server entrance)", () => {
    const rejected = async (q: Record<string, unknown>) => {
      const req: any = { query: { ...q } };
      for (const v of transactionFilterValidators as any[]) await v.run(req);
      return {
        fields: validationResult(req)
          .array()
          .map((e: any) => e.param ?? e.path),
        query: req.query,
      };
    };

    it("accepts whole cents from 0 and turns them into numbers", async () => {
      const r = await rejected({
        depositMin: "0",
        depositMax: "10000",
        withdrawalMin: "500",
        withdrawalMax: "500",
      });
      expect(r.fields).toEqual([]);
      expect(r.query).toMatchObject({
        depositMin: 0,
        depositMax: 10000,
        withdrawalMin: 500,
        withdrawalMax: 500,
      });
    });

    it("edge case: a minimum above its maximum is refused, equal is fine", async () => {
      expect((await rejected({ depositMin: "100000", depositMax: "10000" })).fields).toContain(
        "depositMax"
      );
      expect((await rejected({ withdrawalMin: "5001", withdrawalMax: "5000" })).fields).toContain(
        "withdrawalMax"
      );
      expect((await rejected({ depositMin: "10000", depositMax: "10000" })).fields).toEqual([]);
    });

    it("refuses negative numbers, decimals, text and numbers that are too large", async () => {
      for (const bad of ["-1", "1.5", "abc", "1e3", "2147483648"]) {
        expect((await rejected({ depositMin: bad })).fields, bad).toContain("depositMin");
      }
    });

    it("a missing maximum is fine (no upper limit)", async () => {
      expect((await rejected({ depositMin: "500" })).fields).toEqual([]);
      expect((await rejected({ withdrawalMax: "500" })).fields).toEqual([]);
    });

    it("date range: either side may be missing, start not after end, the same moment is fine", async () => {
      const a = "2026-03-10T00:00:00.000Z";
      const b = "2026-03-10T23:59:59.999Z";
      expect((await rejected({ dateRangeStart: a, dateRangeEnd: b })).fields).toEqual([]);
      expect((await rejected({ dateRangeStart: a, dateRangeEnd: a })).fields).toEqual([]);
      expect((await rejected({ dateRangeStart: b, dateRangeEnd: a })).fields).toContain(
        "dateRangeEnd"
      );
      expect((await rejected({ dateRangeStart: a })).fields).toEqual([]); // from that moment on
      expect((await rejected({ dateRangeEnd: b })).fields).toEqual([]); // up to that moment
      expect((await rejected({ dateRangeStart: "nonsense", dateRangeEnd: b })).fields).toContain(
        "dateRangeStart"
      );
    });
  });
});
