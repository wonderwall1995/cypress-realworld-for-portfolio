// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { DefaultPrivacyLevel } from "@rwa/shared";
import prisma from "../prisma";
import { createUser, getUserById } from "../user-db";
import { createBankAccountForUser } from "../bankaccount-db";
import { attachViewerAccount, getTransactionsForUserForApi } from "../transaction-db";
import { moveMoney } from "../banktransfer-service";
import { passwordMatches } from "../account-money";
import { resetDatabase } from "./db-setup/reset";
import { accountIdOf, createTx, fundUser } from "./db-setup/accounts";

const makeUser = async (name: string, cents: number, bankName = "Test Bank") => {
  const user = await createUser({
    firstName: name,
    lastName: "Test",
    username: name.toLowerCase(),
    password: "s3cret",
    defaultPrivacyLevel: DefaultPrivacyLevel.public,
  });
  const accountId = await fundUser(user.id, cents);
  await prisma.bankAccount.update({ where: { id: accountId }, data: { bankName } });
  return user;
};

const details = (receiverId: string, dollars: number) => ({
  receiverId,
  description: "t",
  amount: dollars,
  privacyLevel: "public",
});

const accountBalance = async (id: string) =>
  (await prisma.bankAccount.findUniqueOrThrow({ where: { id } })).balance;
const sidebar = async (id: string) => (await getUserById(id))!.balance;

describe("transfers between bank accounts (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("payment", () => {
    it("only the two chosen accounts change; the sidebar is the sum of the accounts", async () => {
      const a = await makeUser("A", 10000);
      const b = await makeUser("B", 0);
      const a2 = await createBankAccountForUser(a.id, {
        bankName: "Second",
        accountNumber: "987654321",
      });
      await prisma.bankAccount.update({ where: { id: a2.id }, data: { balance: 3000 } });

      await createTx(a.id, "payment", details(b.id, 20), { myAccountId: a2.id });

      expect(await accountBalance(a2.id)).toBe(1000);
      expect(await accountBalance(accountIdOf(a.id))).toBe(10000); // untouched
      expect(await accountBalance(accountIdOf(b.id))).toBe(2000);
      expect(await sidebar(a.id)).toBe(11000);
      expect(await sidebar(b.id)).toBe(2000);
    });

    it("the chosen account must cover it, even if the user's other accounts could", async () => {
      const a = await makeUser("A", 10000);
      const b = await makeUser("B", 0);
      const a2 = await createBankAccountForUser(a.id, {
        bankName: "Empty",
        accountNumber: "987654321",
      });

      await expect(
        createTx(a.id, "payment", details(b.id, 5), { myAccountId: a2.id })
      ).rejects.toMatchObject({ status: 400 });
      expect(await sidebar(a.id)).toBe(10000);
      expect(await prisma.transaction.count()).toBe(0);
    });

    it("refuses a missing, someone else's or deleted account", async () => {
      const a = await makeUser("A", 10000);
      const b = await makeUser("B", 0);
      const c = await makeUser("C", 10000);
      const gone = await createBankAccountForUser(b.id, {
        bankName: "G",
        accountNumber: "123456789",
      });
      await prisma.bankAccount.update({ where: { id: gone.id }, data: { visible: false } });

      const cases: [string, any, number][] = [
        ["no sender account", { myAccountId: "" }, 400],
        ["sender account does not exist", { myAccountId: "nope" }, 404],
        ["sender account is someone else's", { myAccountId: accountIdOf(c.id) }, 403],
        ["receiver account is the sender's own", { otherAccountId: accountIdOf(a.id) }, 403],
        ["receiver account does not exist", { otherAccountId: "nope" }, 404],
        ["receiver account was deleted", { otherAccountId: gone.id }, 400],
      ];
      for (const [label, accounts, status] of cases) {
        await expect(
          createTx(a.id, "payment", details(b.id, 5), accounts),
          label
        ).rejects.toMatchObject({ status });
      }
      expect(await sidebar(a.id)).toBe(10000);
      expect(await prisma.transaction.count()).toBe(0);
    });

    it("paying yourself between two of your own accounts works, the same account twice does not", async () => {
      const a = await makeUser("A", 10000);
      const a2 = await createBankAccountForUser(a.id, {
        bankName: "Two",
        accountNumber: "987654321",
      });

      await createTx(a.id, "payment", details(a.id, 30), { otherAccountId: a2.id });
      expect(await accountBalance(a2.id)).toBe(3000);
      expect(await sidebar(a.id)).toBe(10000);

      await expect(
        createTx(a.id, "payment", details(a.id, 30), { otherAccountId: accountIdOf(a.id) })
      ).rejects.toMatchObject({ status: 400 });
    });

    it("two opposite payments at the same time do not dead-lock and keep the total", async () => {
      const a = await makeUser("A", 10000);
      const b = await makeUser("B", 10000);

      await Promise.all([
        createTx(a.id, "payment", details(b.id, 10)),
        createTx(b.id, "payment", details(a.id, 20)),
      ]);

      expect(await sidebar(a.id)).toBe(11000);
      expect(await sidebar(b.id)).toBe(9000);
    });
  });

  describe("no requests any more", () => {
    it("a request cannot be created (nothing is saved)", async () => {
      const a = await makeUser("A", 0);
      const b = await makeUser("B", 10000);

      await expect(createTx(a.id, "request" as any, details(b.id, 25))).rejects.toMatchObject({
        status: 400,
      });
      expect(await prisma.transaction.count()).toBe(0);
      expect(await prisma.notification.count()).toBe(0);
    });
  });

  describe("what each user sees next to a transaction", () => {
    it("my own bank name and the balance after, never the other side's", async () => {
      const a = await makeUser("A", 10000, "Alpha Bank");
      const b = await makeUser("B", 500, "Beta Bank");
      const t = await createTx(a.id, "payment", details(b.id, 20));

      const forA = (await attachViewerAccount([t], a.id))[0].myAccount;
      const forB = (await attachViewerAccount([t], b.id))[0].myAccount;
      const forC = (await attachViewerAccount([t], "someone-else"))[0].myAccount;

      expect(forA).toEqual({ bankName: "Alpha Bank", balanceAfter: 8000 });
      expect(forB).toEqual({ bankName: "Beta Bank", balanceAfter: 2500 });
      expect(forC).toBeUndefined();
      expect(JSON.stringify(await attachViewerAccount([t], b.id))).not.toContain("Alpha");
      // the sender's account id (source) is shown to the sender only
      expect((await attachViewerAccount([t], a.id))[0].source).toBe(accountIdOf(a.id));
      expect((await attachViewerAccount([t], b.id))[0].source).toBe("");
      expect((await attachViewerAccount([t], "someone-else"))[0].source).toBe("");
    });

    it("an outside deposit shows the account it went into and the balance after", async () => {
      const a = await makeUser("A", 700, "Alpha Bank");
      await moveMoney(a.id, { bankAccountId: accountIdOf(a.id), amount: 5, type: "deposit" });

      const list = await attachViewerAccount(await getTransactionsForUserForApi(a.id), a.id);
      expect(list[0].myAccount).toEqual({ bankName: "Alpha Bank", balanceAfter: 1200 });
    });
  });

  it("passwordMatches: only the right password", async () => {
    const a = await makeUser("A", 0);
    expect(await passwordMatches(a.id, "s3cret")).toBe(true);
    for (const bad of ["wrong", "", undefined, 123, null]) {
      expect(await passwordMatches(a.id, bad)).toBe(false);
    }
    expect(await passwordMatches("nobody", "s3cret")).toBe(false);
  });
});
