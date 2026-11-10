/**
 * Contacts stored in PostgreSQL (Prisma). Replaces the old JSON-file (lowdb) contact functions.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import prisma from "./prisma";
import { Contact, User } from "@rwa/shared";
import { getUserByUsername } from "./user-db";

export const getAllContacts = (): Promise<Contact[]> =>
  prisma.contact.findMany({ orderBy: { createdAt: "asc" } });

export const getContactsByUserId = (userId: string): Promise<Contact[]> =>
  prisma.contact.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

// An unknown username gives an empty list (the old version threw an error).
export const getContactsByUsername = async (username: string): Promise<Contact[]> => {
  const user = await getUserByUsername(username);
  return user ? getContactsByUserId(user.id) : [];
};

export const getContactIdsForUser = async (userId: string): Promise<User["id"][]> => {
  const contacts = await getContactsByUserId(userId);
  return contacts.map((contact) => contact.contactUserId);
};

export const createContactForUser = (userId: string, contactUserId: string): Promise<Contact> => {
  const now = new Date();
  return prisma.contact.create({
    data: { id: shortid(), uuid: v4(), userId, contactUserId, createdAt: now, modifiedAt: now },
  });
};

// Only the owner can remove a contact. Returns true when a row was removed.
// An id that does not exist, or one that belongs to someone else, does nothing and returns false.
export const removeContactById = async (userId: string, contactId: string): Promise<boolean> => {
  const { count } = await prisma.contact.deleteMany({ where: { id: contactId, userId } });
  return count > 0;
};
