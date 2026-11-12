// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import {
  DefaultPrivacyLevel,
  EXTERNAL_DEPOSIT_NAME,
  EXTERNAL_DEPOSIT_SENDER_ID,
  TransactionStatus,
} from "@rwa/shared";
import prisma from "../prisma";
import { createUser } from "../user-db";
import { createBankAccountForUser } from "../bankaccount-db";
import { moveMoney } from "../banktransfer-service";
import { getPublicTransactionsByQuery, getTransactionsForUserForApi } from "../transaction-db";
import { resetDatabase } from "./db-setup/reset";

const makeUser = (name: string) =>
  createUser({
    firstName: name,
    lastName: "Test",
    username: name.toLowerCase(),
    password: "s3cret",
    defaultPrivacyLevel: DefaultPrivacyLevel.public,
  });

describe("an outside deposit is also a feed entry (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const setup = async () => {
    const me = await makeUser("Me");
    const friend = await makeUser("Friend");
    const stranger = await makeUser("Stranger");
    const account = await createBankAccountForUser(me.id, {
      bankName: "B",
      accountNumber: "123456789",
    });
    const transfer = await moveMoney(me.id, {
      bankAccountId: account.id,
      amount: 40,
      type: "deposit",
    });
    return { me, friend, stranger, account, transfer };
  };

  it("creates a complete, private transaction from the fixed sender to me, linked to the transfer", async () => {
    const { me, account, transfer } = await setup();

    const rows = await prisma.transaction.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      senderId: EXTERNAL_DEPOSIT_SENDER_ID,
      receiverId: me.id,
      amount: 4000,
      privacyLevel: "private",
      status: TransactionStatus.complete,
      source: account.id,
    });
    expect(transfer.transactionId).toBe(rows[0].id);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("my transactions: shown, named 외부 입금", async () => {
    const { me } = await setup();
    const list = await getTransactionsForUserForApi(me.id);
    expect(list).toHaveLength(1);
    expect(list[0].senderName).toBe(EXTERNAL_DEPOSIT_NAME);
    expect(list[0].receiverName).toBe("Test Me");
  });

  it("Everyone tab: shown to me", async () => {
    const { me } = await setup();
    const feed = await getPublicTransactionsByQuery(me.id, {} as any);
    const all = feed;
    expect(all).toHaveLength(1);
    expect(all[0].senderName).toBe(EXTERNAL_DEPOSIT_NAME);
  });

  it("Everyone tab with a filter: the deposit amount filter finds it, the withdrawal one does not", async () => {
    const { me } = await setup();
    const hit = await getPublicTransactionsByQuery(me.id, {
      depositMin: 4000,
      depositMax: 4000,
    } as any);
    expect(hit).toHaveLength(1);
    const miss = await getPublicTransactionsByQuery(me.id, { withdrawalMin: 0 } as any);
    expect(miss).toHaveLength(0);
  });

  it("nobody else sees it: not in another member's Everyone tab or lists", async () => {
    const { friend, stranger } = await setup();
    for (const viewer of [friend, stranger]) {
      const feed = await getPublicTransactionsByQuery(viewer.id, {} as any);
      expect(feed).toHaveLength(0);
      expect(await getTransactionsForUserForApi(viewer.id)).toHaveLength(0);
    }
  });

  it("a rejected deposit leaves no feed entry", async () => {
    const me = await makeUser("Me");
    const account = await createBankAccountForUser(me.id, {
      bankName: "B",
      accountNumber: "123456789",
    });
    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { balance: 2_147_483_000 },
    });
    await expect(
      moveMoney(me.id, { bankAccountId: account.id, amount: 100, type: "deposit" })
    ).rejects.toMatchObject({ status: 400 });
    expect(await prisma.transaction.count()).toBe(0);
  });
});
