// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../../backend/prisma";
import { createUser } from "../../backend/user-db";
import {
  createContactForUser,
  getAllContacts,
  getContactIdsForUser,
  getContactsByUserId,
  getContactsByUsername,
  removeContactById,
} from "../../backend/contact-db";
import { resetDatabase } from "./db-setup/reset";

const newUser = (n: number) =>
  createUser({ firstName: `F${n}`, lastName: `L${n}`, username: `user${n}`, password: "s3cret" });

describe("Contacts (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a contact for a user", async () => {
    const a = await newUser(1);
    const b = await newUser(2);

    const contact = await createContactForUser(a.id, b.id);

    expect(contact.userId).toBe(a.id);
    expect(contact.contactUserId).toBe(b.id);
    expect(contact.id).toBeTruthy();
    expect(contact.createdAt).toBeInstanceOf(Date);
  });

  it("lists all contacts", async () => {
    const [a, b, c] = [await newUser(1), await newUser(2), await newUser(3)];
    await createContactForUser(a.id, b.id);
    await createContactForUser(b.id, c.id);

    expect(await getAllContacts()).toHaveLength(2);
  });

  it("lists the contacts of one user by id and by username", async () => {
    const [a, b, c] = [await newUser(1), await newUser(2), await newUser(3)];
    await createContactForUser(a.id, b.id);
    await createContactForUser(a.id, c.id);
    await createContactForUser(b.id, c.id);

    const byId = await getContactsByUserId(a.id);
    const byName = await getContactsByUsername("user1");

    expect(byId).toHaveLength(2);
    expect(byId.every((contact) => contact.userId === a.id)).toBe(true);
    expect(byName.map((contact) => contact.id)).toEqual(byId.map((contact) => contact.id));
  });

  it("returns an empty list for an unknown username", async () => {
    expect(await getContactsByUsername("nobody")).toEqual([]);
  });

  it("returns the ids of the users in a contact list", async () => {
    const [a, b, c] = [await newUser(1), await newUser(2), await newUser(3)];
    await createContactForUser(a.id, b.id);
    await createContactForUser(a.id, c.id);

    expect((await getContactIdsForUser(a.id)).sort()).toEqual([b.id, c.id].sort());
    expect(await getContactIdsForUser(b.id)).toEqual([]);
  });

  it("deletes a contact and ignores an unknown id", async () => {
    const a = await newUser(1);
    const b = await newUser(2);
    const contact = await createContactForUser(a.id, b.id);

    await removeContactById(contact.id);
    await removeContactById("does-not-exist");

    expect(await getContactsByUserId(a.id)).toHaveLength(0);
  });
});
