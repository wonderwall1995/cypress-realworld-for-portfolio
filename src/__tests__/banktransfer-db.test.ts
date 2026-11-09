// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../../backend/prisma";
import {
  changeBankTransferStatus,
  createBankTransfer,
  getBankTransferByTransactionId,
  getBankTransferLogs,
  getBankTransfersByUserId,
} from "../../backend/banktransfer-db";
import { resetDatabase } from "./db-setup/reset";
import { BankTransferType } from "../models";

const withdrawal = (over = {}) => ({
  userId: "u1",
  source: "acct1",
  amount: 5000,
  type: BankTransferType.withdrawal,
  ...over,
});

describe("Bank transfers (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a completed transfer by default and writes the first log row", async () => {
    const t = await createBankTransfer(
      withdrawal({ transactionId: "tx1", balanceBefore: 1000, balanceAfter: 0 })
    );

    expect(t.status).toBe("completed");
    expect(t.type).toBe("withdrawal");
    expect(t.balanceBefore).toBe(1000);
    expect(t.balanceAfter).toBe(0);

    const logs = await getBankTransferLogs(t.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].fromStatus).toBeNull();
    expect(logs[0].toStatus).toBe("completed");
    expect(logs[0].bankAccountId).toBe("acct1");
    expect(logs[0].amount).toBe(5000);
  });

  it("can start as requested (virtual deposit waiting for a result)", async () => {
    const t = await createBankTransfer(
      withdrawal({ type: BankTransferType.deposit, status: "requested" })
    );

    expect(t.status).toBe("requested");
    expect(t.type).toBe("deposit");
  });

  it("rejects an amount that is not a positive whole number", async () => {
    await expect(createBankTransfer(withdrawal({ amount: 0 }))).rejects.toThrow();
    await expect(createBankTransfer(withdrawal({ amount: -5 }))).rejects.toThrow();
    await expect(createBankTransfer(withdrawal({ amount: 10.5 }))).rejects.toThrow();
  });

  it("finds transfers by user and by transaction id", async () => {
    await createBankTransfer(withdrawal({ transactionId: "tx1" }));
    await createBankTransfer(withdrawal({ userId: "u2", transactionId: "tx2" }));

    expect(await getBankTransfersByUserId("u1")).toHaveLength(1);
    expect((await getBankTransferByTransactionId("tx2"))!.userId).toBe("u2");
    expect(await getBankTransferByTransactionId("none")).toBeUndefined();
  });

  it("moves requested -> completed and records the status change with balances", async () => {
    const t = await createBankTransfer(
      withdrawal({ type: BankTransferType.deposit, status: "requested" })
    );

    const done = await changeBankTransferStatus(t.id, "completed", {
      balanceBefore: 1000,
      balanceAfter: 6000,
      note: "virtual deposit",
    });

    expect(done.status).toBe("completed");
    expect(done.balanceAfter).toBe(6000);

    const logs = await getBankTransferLogs(t.id);
    expect(logs.map((l) => [l.fromStatus, l.toStatus])).toEqual([
      [null, "requested"],
      ["requested", "completed"],
    ]);
    expect(logs[1].balanceBefore).toBe(1000);
    expect(logs[1].note).toBe("virtual deposit");
  });

  it("does not allow a change out of a final status", async () => {
    const t = await createBankTransfer(withdrawal());

    await expect(changeBankTransferStatus(t.id, "failed")).rejects.toThrow(/completed/);
    expect(await getBankTransferLogs(t.id)).toHaveLength(1);
  });

  it("fails for an unknown transfer without writing a log", async () => {
    await expect(changeBankTransferStatus("nope", "completed")).rejects.toThrow(/not found/);
    expect(await prisma.bankTransferLog.count()).toBe(0);
  });

  it("keeps the history: a transfer that has logs cannot be deleted", async () => {
    const t = await createBankTransfer(withdrawal());

    await expect(prisma.bankTransfer.delete({ where: { id: t.id } })).rejects.toThrow();
    expect(await getBankTransferLogs(t.id)).toHaveLength(1);
  });
});
