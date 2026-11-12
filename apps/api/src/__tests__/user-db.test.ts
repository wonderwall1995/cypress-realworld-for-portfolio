// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "../prisma";
import {
  createUser,
  getAllUsers,
  getUserById,
  getUserByUsername,
  updateUserById,
  searchUsers,
  removeUserFromResults,
  getFullNameForUser,
} from "../user-db";
import { resetDatabase } from "./db-setup/reset";
import { DefaultPrivacyLevel } from "@rwa/shared";

const signUp = (n: number) => ({
  firstName: `First${n}`,
  lastName: `Last${n}`,
  username: `user${n}`,
  password: "s3cret",
});

describe("Users (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a user from sign-up fields and hashes the password", async () => {
    const user = await createUser(signUp(1));

    expect(user.id).toBeTruthy();
    expect(user.balance).toBe(0);
    expect(user.password).not.toBe("s3cret");
    expect(bcrypt.compareSync("s3cret", user.password)).toBe(true);
  });

  it("returns undefined (not null) for profile fields that are not set yet", async () => {
    const user = await createUser(signUp(1));
    const found = await getUserById(user.id);

    expect(found).toBeDefined();
    expect(found!.email).toBeUndefined();
    expect(found!.phoneNumber).toBeUndefined();
    expect(found!.avatar).toBeUndefined();
    expect(found!.defaultPrivacyLevel).toBeUndefined();
  });

  it("gets a user by id and by username, and undefined when missing", async () => {
    const user = await createUser(signUp(1));

    expect((await getUserById(user.id))!.username).toBe("user1");
    expect((await getUserByUsername("user1"))!.id).toBe(user.id);
    expect(await getUserById("nope")).toBeUndefined();
    expect(await getUserByUsername("nope")).toBeUndefined();
  });

  it("rejects a duplicate username", async () => {
    await createUser(signUp(1));
    await expect(createUser(signUp(1))).rejects.toThrow();
  });

  it("lists all users", async () => {
    await createUser(signUp(1));
    await createUser(signUp(2));

    expect(await getAllUsers()).toHaveLength(2);
  });

  it("updates profile fields and ignores fields that are not editable", async () => {
    const user = await createUser(signUp(1));

    await updateUserById(user.id, {
      email: "a@b.com",
      phoneNumber: "201-555-0100",
      defaultPrivacyLevel: DefaultPrivacyLevel.contacts,
      username: "hacked",
      id: "other",
    });

    const found = (await getUserById(user.id))!;
    expect(found.email).toBe("a@b.com");
    expect(found.phoneNumber).toBe("201-555-0100");
    expect(found.defaultPrivacyLevel).toBe("contacts");
    expect(found.username).toBe("user1");
    expect(found.id).toBe(user.id);
  });

  describe("search", () => {
    beforeEach(async () => {
      await createUser({
        ...signUp(1),
        email: "ted@example.com",
        phoneNumber: "201-555-0100",
      });
      await createUser({ ...signUp(2), email: "ann@example.com", phoneNumber: "398-225-9900" });
    });

    it("finds a user by email address", async () => {
      const users = await searchUsers("ted@example.com");
      expect(users[0].username).toBe("user1");
    });

    it("finds a user by username", async () => {
      const users = await searchUsers("user2");
      expect(users[0].username).toBe("user2");
    });

    it("finds a user by phone number", async () => {
      const users = await searchUsers("398-225-9900");
      expect(users[0].username).toBe("user2");
    });

    it("finds users by a fuzzy first name", async () => {
      const users = await searchUsers("First1");
      expect(users.length).toBeGreaterThanOrEqual(1);
    });

    it("finds users by part of a phone number (fuzzy)", async () => {
      const users = await searchUsers("201");
      expect(users.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("search by name or phone (OR)", () => {
    beforeEach(async () => {
      await createUser({
        firstName: "웅기",
        lastName: "홍",
        username: "hong",
        password: "s3cret",
        phoneNumber: "010-1234-5678",
      });
      await createUser({
        firstName: "철수",
        lastName: "김",
        username: "kim",
        password: "s3cret",
        phoneNumber: "010-9999-0000",
      });
    });

    const names = async (q: string) => (await searchUsers(q)).map((u) => u.username);

    it("finds a Korean name in either order, with or without a space", async () => {
      for (const q of ["홍웅기", "홍 웅기", "웅기 홍", "웅기홍", "홍", "웅기", "웅"]) {
        expect(await names(q), q).toEqual(["hong"]);
      }
    });

    it("finds a phone number typed with or without hyphens, or part of it", async () => {
      for (const q of ["010-1234-5678", "01012345678", "010 1234 5678", "1234", "5678"]) {
        expect(await names(q), q).toEqual(["hong"]);
      }
    });

    it("a name query does not match phone numbers, and an unknown name finds nobody", async () => {
      expect(await names("철수")).toEqual(["kim"]);
      expect(await names("없는사람")).toEqual([]);
    });

    it("nothing typed (empty, spaces, only symbols that are ignored) lists every member", async () => {
      for (const q of ["", "   ", " - "]) {
        expect((await names(q)).sort(), JSON.stringify(q)).toEqual(["hong", "kim"]);
      }
    });
  });

  it("removes the signed-in user from a result list", async () => {
    const a = await createUser(signUp(1));
    await createUser(signUp(2));

    const results = removeUserFromResults(a.id, await getAllUsers());
    expect(results.map((u) => u.username)).toEqual(["user2"]);
  });

  it("builds the full name used in the transaction feed", async () => {
    const user = await createUser(signUp(1));

    expect(await getFullNameForUser(user.id)).toBe("Last1 First1");
    expect(await getFullNameForUser("nope")).toBe("");
  });
});
