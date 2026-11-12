// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { validationResult } from "express-validator";
import {
  isValidAccountNumber,
  isValidAmountDollars,
  MAX_AMOUNT_DOLLARS,
  MAX_BALANCE_CENTS,
  TransactionPayload,
} from "@rwa/shared";
import prisma from "../prisma";
import { fundUser, createTx } from "./db-setup/accounts";
import { createUser, getUserById, updateUserById } from "../user-db";
import { getAllTransactions } from "../transaction-db";
import { createBankAccountForUser, getBankAccountsByUserId } from "../bankaccount-db";
import { isBankAccountValidator, isTransactionPayloadValidator } from "../validators";
import { resetDatabase } from "./db-setup/reset";

// Runs a validator list on a fake request and returns the fields that were rejected.
const rejectedFields = async (validators: any[], body: Record<string, unknown>) => {
  const req: any = { body };
  for (const v of validators) await v.run(req);
  const fields = validationResult(req)
    .array()
    .map((e: any) => e.param ?? e.path);
  return { fields, body: req.body };
};

describe("shared number rules", () => {
  it("amount: whole dollars from 1 to the maximum", () => {
    for (const ok of [1, 12, MAX_AMOUNT_DOLLARS]) expect(isValidAmountDollars(ok)).toBe(true);
    for (const bad of [
      0,
      -1,
      -50,
      1.5,
      NaN,
      Infinity,
      MAX_AMOUNT_DOLLARS + 1,
      "5",
      null,
      undefined,
    ]) {
      expect(isValidAmountDollars(bad)).toBe(false);
    }
  });

  it("the largest amount in cents still fits the 32-bit balance column", () => {
    expect(MAX_AMOUNT_DOLLARS * 100).toBeLessThanOrEqual(MAX_BALANCE_CENTS);
    expect((MAX_AMOUNT_DOLLARS + 1) * 100).toBeGreaterThan(MAX_BALANCE_CENTS);
  });

  it("account number: 9 to 12 digits", () => {
    for (const ok of ["123456789", "000123456789", "1".repeat(12)])
      expect(isValidAccountNumber(ok)).toBe(true);
    for (const bad of [
      "12345678",
      "1".repeat(13),
      "12345678a",
      "abc",
      "-12345678",
      "",
      123456789,
    ]) {
      expect(isValidAccountNumber(bad)).toBe(false);
    }
  });
});

describe("route validators (the server entrance)", () => {
  const payload = (amount: unknown) => ({
    transactionType: "payment",
    receiverId: "x",
    description: "d",
    amount,
  });

  it("transaction amount: 0, negative, decimals, text and too large are rejected", async () => {
    for (const bad of [
      0,
      "0",
      -5,
      "-5",
      1.5,
      "1.5",
      "1e3",
      "abc",
      "",
      null,
      MAX_AMOUNT_DOLLARS + 1,
    ]) {
      const { fields } = await rejectedFields(isTransactionPayloadValidator as any[], payload(bad));
      expect(fields, `amount ${JSON.stringify(bad)} should be rejected`).toContain("amount");
    }
  });

  it("transaction amount: whole dollars are accepted and become numbers", async () => {
    for (const [input, expected] of [
      [12, 12],
      ["12", 12],
      [" 7 ", 7],
      [MAX_AMOUNT_DOLLARS, MAX_AMOUNT_DOLLARS],
    ] as const) {
      const { fields, body } = await rejectedFields(
        isTransactionPayloadValidator as any[],
        payload(input)
      );
      expect(fields).not.toContain("amount");
      expect(body.amount).toBe(expected);
    }
  });

  it("bank account: numbers must be digits of the right length, bank name must be filled in", async () => {
    const good = { bankName: "데모은행", accountNumber: "123456789" };
    expect((await rejectedFields(isBankAccountValidator as any[], good)).fields).toEqual([]);

    const cases: [string, Record<string, unknown>, string][] = [
      ["account letters", { ...good, accountNumber: "abcdefghi" }, "accountNumber"],
      ["account 8 digits", { ...good, accountNumber: "12345678" }, "accountNumber"],
      ["account 13 digits", { ...good, accountNumber: "1".repeat(13) }, "accountNumber"],
      ["empty bank name", { ...good, bankName: "   " }, "bankName"],
    ];
    for (const [label, body, field] of cases) {
      const { fields } = await rejectedFields(isBankAccountValidator as any[], body);
      expect(fields, label).toContain(field);
    }
  });
});

describe("services (the check inside, used by every caller)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const twoUsers = async (aBalance = 10000, bBalance = 10000) => {
    const a = await createUser({
      firstName: "A",
      lastName: "A",
      username: "ua",
      password: "s3cret",
    });
    const b = await createUser({
      firstName: "B",
      lastName: "B",
      username: "ub",
      password: "s3cret",
    });
    await fundUser(a.id, aBalance);
    await fundUser(b.id, bBalance);
    return { a, b };
  };

  const pay = (receiverId: string, amount: unknown) =>
    ({
      source: "acct1",
      receiverId,
      description: "x",
      amount,
      privacyLevel: "public",
    }) as unknown as TransactionPayload;

  it("a transfer with 0, a negative, a decimal or too large amount is refused (400) and changes nothing", async () => {
    const { a, b } = await twoUsers();

    for (const bad of [-50, 0, 1.5, NaN, MAX_AMOUNT_DOLLARS + 1, "5"]) {
      await expect(createTx(a.id, "payment", pay(b.id, bad)), String(bad)).rejects.toMatchObject({
        status: 400,
      });
    }
    expect(await getAllTransactions()).toHaveLength(0);
    expect((await getUserById(a.id))!.balance).toBe(10000);
    expect((await getUserById(b.id))!.balance).toBe(10000);
    expect(await prisma.bankTransfer.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("the smallest ($1) amount is accepted", async () => {
    const { a, b } = await twoUsers(100, 0);

    const small = await createTx(a.id, "payment", pay(b.id, 1));
    expect(small.amount).toBe(100);
  });

  it("the largest allowed amount is accepted", async () => {
    const { a, b } = await twoUsers(MAX_AMOUNT_DOLLARS * 100, 0);

    const big = await createTx(a.id, "payment", pay(b.id, MAX_AMOUNT_DOLLARS));
    expect(big.amount).toBe(MAX_AMOUNT_DOLLARS * 100);
    expect((await getUserById(b.id))!.balance).toBe(MAX_AMOUNT_DOLLARS * 100);
  });

  it("a payment that would push the receiver's balance past the limit is refused and changes nothing", async () => {
    const { a, b } = await twoUsers(10000, MAX_BALANCE_CENTS - 500);

    await expect(createTx(a.id, "payment", pay(b.id, 100))).rejects.toMatchObject({
      status: 400,
    });

    expect(await getAllTransactions()).toHaveLength(0);
    expect((await getUserById(a.id))!.balance).toBe(10000);
    expect((await getUserById(b.id))!.balance).toBe(MAX_BALANCE_CENTS - 500);
    expect(await prisma.bankTransfer.count()).toBe(0);
  });

  describe("creating a bank account", () => {
    const details = {
      bankName: "Demo Bank",

      accountNumber: "123456789",
    };

    it("keeps numbers that start with 0 exactly as typed", async () => {
      const a = await createBankAccountForUser("u1", { ...details, accountNumber: "000123456789" });

      expect(a.accountNumber).toBe("000123456789");
    });

    it("refuses non-digit, wrong-length numbers and an empty bank name (400), and saves nothing", async () => {
      const bad = [
        { ...details, accountNumber: "abcdefghi" },
        { ...details, accountNumber: "12345678" },
        { ...details, accountNumber: "1".repeat(13) },
        { ...details, bankName: "  " },
        { ...details, bankName: undefined },
      ];
      for (const b of bad) {
        await expect(createBankAccountForUser("u1", b as any)).rejects.toMatchObject({
          status: 400,
        });
      }
      expect(await getBankAccountsByUserId("u1")).toHaveLength(0);
    });
  });
});
