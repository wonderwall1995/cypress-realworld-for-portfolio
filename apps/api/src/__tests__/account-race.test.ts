// @vitest-environment node
// Requests that arrive at the same moment (the web and the app of one member, or two members): money never gets lost.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "../prisma";
import { createBankAccountForUser, removeBankAccountById } from "../bankaccount-db";
import { moveMoney } from "../banktransfer-service";
import { createTransaction } from "../transaction-db";
import { createUser } from "../user-db";
import { MAX_BANK_ACCOUNTS } from "@rwa/shared";
import { resetDatabase } from "./db-setup/reset";

const ROUNDS = 15; // the order inside a round differs, so one round proves nothing

let made = 0;
const newUser = () => {
  made += 1;
  return createUser({ firstName: "F", lastName: "L", username: `race${made}`, password: "s3cret" });
};
const newAccount = (userId: string) =>
  createBankAccountForUser(userId, { bankName: "Demo Bank", accountNumber: "123456789" });
const deposit = (userId: string, bankAccountId: string, amount: number) =>
  moveMoney(userId, { bankAccountId, amount, type: "deposit" });
const pay = (from: string, fromAccount: string, to: string, toAccount: string, amount: number) =>
  createTransaction(from, "payment", {
    receiverId: to,
    myAccountId: fromAccount,
    otherAccountId: toAccount,
    amount,
    description: "race",
  } as any);

/** The rules that hold whatever the order was. */
const expectMoneyInOrder = async (...userIds: string[]) => {
  const accounts = await prisma.bankAccount.findMany({ where: { userId: { in: userIds } } });
  expect(accounts.filter((account) => !account.visible && account.balance !== 0)).toEqual([]);
  for (const userId of userIds) {
    const sum = accounts
      .filter((account) => account.userId === userId && account.visible)
      .reduce((total, account) => total + account.balance, 0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(sum);
  }
};

describe("requests at the same moment", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("the limit of bank accounts holds", async () => {
    const user = await newUser();
    for (let count = 0; count < MAX_BANK_ACCOUNTS - 1; count += 1) await newAccount(user.id);

    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => newAccount(user.id)));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.bankAccount.count({ where: { userId: user.id, visible: true } })).toBe(
      MAX_BANK_ACCOUNTS
    );
  });

  it("an account is deleted or gets the deposit, never both", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const user = await newUser();
      const account = await newAccount(user.id);
      const results = await Promise.allSettled([
        deposit(user.id, account.id, 5),
        removeBankAccountById(user.id, account.id),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      await expectMoneyInOrder(user.id);
    }
  });

  it("an account is deleted or receives the transfer, never both", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [payer, payee] = [await newUser(), await newUser()];
      const [from, to] = [await newAccount(payer.id), await newAccount(payee.id)];
      await deposit(payer.id, from.id, 5);
      const results = await Promise.allSettled([
        pay(payer.id, from.id, payee.id, to.id, 5),
        removeBankAccountById(payee.id, to.id),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      await expectMoneyInOrder(payer.id, payee.id);
    }
  });

  it("an account that is sending everything can be deleted only after it is empty", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [payer, payee] = [await newUser(), await newUser()];
      const [from, to] = [await newAccount(payer.id), await newAccount(payee.id)];
      await deposit(payer.id, from.id, 5);
      const [paid] = await Promise.allSettled([
        pay(payer.id, from.id, payee.id, to.id, 5),
        removeBankAccountById(payer.id, from.id),
      ]);
      expect(paid.status).toBe("fulfilled");
      await expectMoneyInOrder(payer.id, payee.id);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: payee.id } })).balance).toBe(500);
    }
  });

  it("deposits into two accounts of one member both count in the member's balance", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const user = await newUser();
      const [one, two] = [await newAccount(user.id), await newAccount(user.id)];
      await Promise.all([deposit(user.id, one.id, 5), deposit(user.id, two.id, 7)]);
      await expectMoneyInOrder(user.id);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).balance).toBe(1200);
    }
  });

  it("transfers in both directions between two members do not wait for each other for ever", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [a, b] = [await newUser(), await newUser()];
      const [accountA, accountB] = [await newAccount(a.id), await newAccount(b.id)];
      await deposit(a.id, accountA.id, 10);
      await deposit(b.id, accountB.id, 10);
      await Promise.all([
        pay(a.id, accountA.id, b.id, accountB.id, 3),
        pay(b.id, accountB.id, a.id, accountA.id, 4),
      ]);
      await expectMoneyInOrder(a.id, b.id);
    }
  });
});
