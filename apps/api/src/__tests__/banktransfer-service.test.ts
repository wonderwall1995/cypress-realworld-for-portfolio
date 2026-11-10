// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../prisma";
import { createUser, getUserById, updateUserById } from "../user-db";
import { createBankAccountForUser, removeBankAccountById } from "../bankaccount-db";
import { getBankTransferLogs, getBankTransfersByUserId } from "../banktransfer-db";
import { moveMoney } from "../banktransfer-service";
import { resetDatabase } from "./db-setup/reset";

const bank = { bankName: "Demo Bank", accountNumber: "123456789" };

const setup = async (balanceCents = 0) => {
  const user = await createUser({
    firstName: "Dem",
    lastName: "O",
    username: `user${Math.random().toString(36).slice(2, 8)}`,
    password: "s3cret",
  });
  if (balanceCents) await updateUserById(user.id, { balance: balanceCents });
  const account = await createBankAccountForUser(user.id, bank);
  return { user, account };
};

const balanceOf = async (id: string) => (await getUserById(id))!.balance;
const accountBalance = async (id: string) =>
  (await prisma.bankAccount.findUniqueOrThrow({ where: { id } })).balance;

describe("Virtual deposit / withdrawal (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("deposit", () => {
    it("adds the amount (whole dollars) to the BANK ACCOUNT balance, not the app balance", async () => {
      const { user, account } = await setup(500);

      const transfer = await moveMoney(user.id, {
        bankAccountId: account.id,
        amount: 12,
        type: "deposit",
      });

      expect(transfer.status).toBe("completed");
      expect(transfer.type).toBe("deposit");
      expect(transfer.amount).toBe(1200);
      expect(transfer.source).toBe(account.id);
      expect(transfer.balanceBefore).toBe(0); // bank account balance before
      expect(transfer.balanceAfter).toBe(1200);
      expect(await accountBalance(account.id)).toBe(1200);
      expect(await balanceOf(user.id)).toBe(500); // app balance untouched

      await moveMoney(user.id, { bankAccountId: account.id, amount: 3, type: "deposit" });
      expect(await accountBalance(account.id)).toBe(1500);
    });

    it("only the chosen account grows", async () => {
      const { user, account } = await setup();
      const second = await createBankAccountForUser(user.id, bank);

      await moveMoney(user.id, { bankAccountId: second.id, amount: 7, type: "deposit" });

      expect(await accountBalance(second.id)).toBe(700);
      expect(await accountBalance(account.id)).toBe(0);
    });

    it("two deposits at the same time are both counted", async () => {
      const { user, account } = await setup();

      await Promise.all([
        moveMoney(user.id, { bankAccountId: account.id, amount: 10, type: "deposit" }),
        moveMoney(user.id, { bankAccountId: account.id, amount: 20, type: "deposit" }),
      ]);

      expect(await accountBalance(account.id)).toBe(3000);
    });

    it("leaves a two-row history: requested, then completed with the balances", async () => {
      const { user, account } = await setup(0);

      const transfer = await moveMoney(user.id, {
        bankAccountId: account.id,
        amount: 5,
        type: "deposit",
      });
      const logs = await getBankTransferLogs(transfer.id);

      expect(logs.map((l) => [l.fromStatus, l.toStatus])).toEqual([
        [null, "requested"],
        ["requested", "completed"],
      ]);
      expect(logs.every((l) => l.userId === user.id && l.bankAccountId === account.id)).toBe(true);
      expect(logs.every((l) => l.amount === 500)).toBe(true);
      expect(logs[1].balanceBefore).toBe(0); // bank account balance
      expect(logs[1].balanceAfter).toBe(500);
    });

    it("shows up in the user's transfer list", async () => {
      const { user, account } = await setup();

      await moveMoney(user.id, { bankAccountId: account.id, amount: 1, type: "deposit" });
      await moveMoney(user.id, { bankAccountId: account.id, amount: 2, type: "deposit" });

      expect(await getBankTransfersByUserId(user.id)).toHaveLength(2);
    });
  });

  describe("withdrawal", () => {
    it("takes the amount from the app balance", async () => {
      const { user, account } = await setup(5000);

      const transfer = await moveMoney(user.id, {
        bankAccountId: account.id,
        amount: 20,
        type: "withdrawal",
      });

      expect(transfer.type).toBe("withdrawal");
      expect(transfer.balanceBefore).toBe(5000);
      expect(transfer.balanceAfter).toBe(3000);
      expect(await balanceOf(user.id)).toBe(3000);
    });

    it("can empty the balance exactly, but not go below zero", async () => {
      const { user, account } = await setup(1000);

      await moveMoney(user.id, { bankAccountId: account.id, amount: 10, type: "withdrawal" });
      expect(await balanceOf(user.id)).toBe(0);

      await expect(
        moveMoney(user.id, { bankAccountId: account.id, amount: 1, type: "withdrawal" })
      ).rejects.toMatchObject({ status: 400 });
      expect(await balanceOf(user.id)).toBe(0);
    });

    it("two withdrawals at the same time cannot overdraw the balance", async () => {
      const { user, account } = await setup(10000); // $100

      const results = await Promise.allSettled([
        moveMoney(user.id, { bankAccountId: account.id, amount: 60, type: "withdrawal" }),
        moveMoney(user.id, { bankAccountId: account.id, amount: 60, type: "withdrawal" }),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(await balanceOf(user.id)).toBe(4000);
      expect(await getBankTransfersByUserId(user.id)).toHaveLength(1);
    });
  });

  describe("rejected requests leave no record and no balance change", () => {
    const expectNothingSaved = async (userId: string, balance: number) => {
      expect(await balanceOf(userId)).toBe(balance);
      expect(await prisma.bankTransfer.count()).toBe(0);
      expect(await prisma.bankTransferLog.count()).toBe(0);
    };

    it("not enough balance for a withdrawal (400)", async () => {
      const { user, account } = await setup(500);

      await expect(
        moveMoney(user.id, { bankAccountId: account.id, amount: 6, type: "withdrawal" })
      ).rejects.toMatchObject({ status: 400 });
      await expectNothingSaved(user.id, 500);
    });

    it("a bank account that does not exist (404)", async () => {
      const { user } = await setup(500);

      await expect(
        moveMoney(user.id, { bankAccountId: "nope", amount: 5, type: "deposit" })
      ).rejects.toMatchObject({ status: 404 });
      await expectNothingSaved(user.id, 500);
    });

    it("someone else's bank account (403)", async () => {
      const mine = await setup(500);
      const other = await setup(0);

      await expect(
        moveMoney(mine.user.id, { bankAccountId: other.account.id, amount: 5, type: "deposit" })
      ).rejects.toMatchObject({ status: 403 });
      await expectNothingSaved(mine.user.id, 500);
      expect(await balanceOf(other.user.id)).toBe(0);
    });

    it("a deleted bank account (400)", async () => {
      const { user, account } = await setup(500);
      await removeBankAccountById(user.id, account.id);

      await expect(
        moveMoney(user.id, { bankAccountId: account.id, amount: 5, type: "deposit" })
      ).rejects.toMatchObject({ status: 400 });
      await expectNothingSaved(user.id, 500);
    });

    it("an amount that is not a whole number of dollars, 1 or more (400)", async () => {
      const { user, account } = await setup(500);

      for (const amount of [0, -5, 2.5, Number.NaN]) {
        await expect(
          moveMoney(user.id, { bankAccountId: account.id, amount, type: "deposit" })
        ).rejects.toMatchObject({ status: 400 });
      }
      await expectNothingSaved(user.id, 500);
    });

    it("an unknown type (400)", async () => {
      const { user, account } = await setup(500);

      await expect(
        moveMoney(user.id, { bankAccountId: account.id, amount: 5, type: "gift" as any })
      ).rejects.toMatchObject({ status: 400 });
      await expectNothingSaved(user.id, 500);
    });

    it("a deposit that would push the account balance past the database limit (400)", async () => {
      const { user, account } = await setup(500);
      await prisma.bankAccount.update({
        where: { id: account.id },
        data: { balance: 2_147_483_000 },
      });

      await expect(
        moveMoney(user.id, { bankAccountId: account.id, amount: 100, type: "deposit" })
      ).rejects.toMatchObject({ status: 400 });
      await expectNothingSaved(user.id, 500);
      expect(await accountBalance(account.id)).toBe(2_147_483_000);
    });
  });
});
