// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../prisma";
import {
  createBankAccountForUser,
  getBankAccountById,
  getBankAccountsByUserId,
  removeBankAccountById,
} from "../bankaccount-db";
import { resetDatabase } from "./db-setup/reset";

const details = { bankName: "Test Bank", accountNumber: "123456789" };

describe("Bank accounts (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates an account for a user", async () => {
    const account = await createBankAccountForUser("u1", details);

    expect(account.userId).toBe("u1");
    expect(account.bankName).toBe("Test Bank");
    expect(account.visible).toBe(true);
    expect(account.createdAt).toBeInstanceOf(Date);
  });

  it("lists the accounts of one user", async () => {
    await createBankAccountForUser("u1", details);
    await createBankAccountForUser("u1", { ...details, bankName: "Second" });
    await createBankAccountForUser("u2", details);

    const accounts = await getBankAccountsByUserId("u1");

    expect(accounts).toHaveLength(2);
    expect(accounts.every((a) => a.userId === "u1")).toBe(true);
  });

  it("gets an account by id, or null when missing", async () => {
    const account = await createBankAccountForUser("u1", details);

    expect((await getBankAccountById(account.id))!.accountNumber).toBe("123456789");
    expect(await getBankAccountById("nope")).toBeNull();
  });

  it("soft deletes: the row stays with visible=false, and the list hides it", async () => {
    const account = await createBankAccountForUser("u1", details);

    expect(await removeBankAccountById("u1", account.id)).toBe(true);

    expect(await getBankAccountsByUserId("u1")).toHaveLength(0);
    expect((await getBankAccountById(account.id))!.visible).toBe(false);
  });

  it("does not delete the account of another user", async () => {
    const account = await createBankAccountForUser("u1", details);

    expect(await removeBankAccountById("u2", account.id)).toBe(false);

    expect((await getBankAccountById(account.id))!.visible).toBe(true);
  });

  it("returns false for an account that does not exist", async () => {
    expect(await removeBankAccountById("u1", "nope")).toBe(false);
  });
});
