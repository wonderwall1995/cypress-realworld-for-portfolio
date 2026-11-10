/**
 * Users stored in PostgreSQL (Prisma). Replaces the old JSON-file (lowdb) user functions.
 *
 * Results keep the old shape: columns that are NULL in the database come back as
 * `undefined`, like the old JSON-file version, so the API response and the UI do not change.
 */
import bcrypt from "bcryptjs";
import Fuse from "fuse.js";
import shortid from "shortid";
import { v4 } from "uuid";
import type { User as UserRow } from "@prisma/client";
import prisma from "./prisma";
import { User } from "@rwa/shared";
import { formatFullName } from "@rwa/shared";

const toUser = (row: UserRow): User =>
  ({
    id: row.id,
    uuid: row.uuid,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    password: row.password,
    email: row.email ?? undefined,
    phoneNumber: row.phoneNumber ?? undefined,
    avatar: row.avatar ?? undefined,
    defaultPrivacyLevel: row.defaultPrivacyLevel ?? undefined,
    balance: row.balance,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  }) as User;

export const getAllUsers = async (): Promise<User[]> => {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toUser);
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toUser(row) : undefined;
};

export const getUserByUsername = async (username: string): Promise<User | undefined> => {
  const row = await prisma.user.findUnique({ where: { username } });
  return row ? toUser(row) : undefined;
};

export const createUser = async (userDetails: Partial<User>): Promise<User> => {
  const now = new Date();
  const row = await prisma.user.create({
    data: {
      id: shortid(),
      uuid: v4(),
      firstName: userDetails.firstName!,
      lastName: userDetails.lastName!,
      username: userDetails.username!,
      password: bcrypt.hashSync(userDetails.password!, 10),
      email: userDetails.email,
      phoneNumber: userDetails.phoneNumber,
      avatar: userDetails.avatar,
      defaultPrivacyLevel: userDetails.defaultPrivacyLevel,
      balance: Number(userDetails.balance!) || 0,
      createdAt: now,
      modifiedAt: now,
    },
  });
  return toUser(row);
};

// Only these columns can be edited through the API (same list the settings form sends).
const EDITABLE: (keyof User)[] = [
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "avatar",
  "defaultPrivacyLevel",
  "balance",
];

export const updateUserById = async (userId: string, edits: Partial<User>): Promise<void> => {
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (edits[key] !== undefined) data[key] = edits[key];
  }
  await prisma.user.update({ where: { id: userId }, data: { ...data, modifiedAt: new Date() } });
};

// Search: same fuzzy match (Fuse) over the same fields as the old JSON-file version.
const cleanSearchQuery = (query: string) => query.replace(/[^a-zA-Z0-9]/g, "");

export const searchUsers = async (query: string): Promise<User[]> => {
  const items = await getAllUsers();
  const fuse = new Fuse(items, {
    keys: ["firstName", "lastName", "username", "email", "phoneNumber"],
  });
  return fuse.search(cleanSearchQuery(query)).map((result) => result.item);
};

export const removeUserFromResults = (userId: User["id"], results: User[]): User[] =>
  results.filter((user) => user.id !== userId);

export const getFullNameForUser = async (userId: User["id"]): Promise<string> => {
  const user = await getUserById(userId);
  return user ? formatFullName(user) : "";
};
