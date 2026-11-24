/**
 * Users stored in PostgreSQL (Prisma). Replaces the old JSON-file (lowdb) user functions.
 *
 * Results keep the old shape: columns that are NULL in the database come back as
 * `undefined`, like the old JSON-file version, so the API response and the UI do not change.
 */
import bcrypt from "bcryptjs";
import shortid from "shortid";
import { v4 } from "uuid";
import { Prisma, type User as UserRow } from "@prisma/client";
import { HttpError } from "./http-error";
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

// P2002: the database refused a second row with the same value. Only the user name can be taken by someone else.
const isTakenUsername = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  String(error.meta?.target).includes("username");

/** Answers 409 when the user name is taken, also when two sign-ups race. */
export const createUser = async (userDetails: Partial<User>): Promise<User> => {
  const now = new Date();
  const saved = prisma.user.create({
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
  const row = await saved.catch((error) => {
    if (isTakenUsername(error)) throw new HttpError(409, "this username is already taken");
    throw error;
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

// Search: a member matches when ANY of these (OR) contains what was typed:
//   name (either order, spaces ignored: "홍길동", "길동 홍", "홍 길동"), username, e-mail,
//   phone number (digits only: "01012345678" finds "010-1234-5678").
const compact = (text: string) => text.toLowerCase().replace(/[\s\-()+._@]/g, "");
const digitsOnly = (text: string) => text.replace(/\D/g, "");

export const userMatchesQuery = (user: User, query: string): boolean => {
  const q = compact(query);
  if (q === "") return false;
  const names = [
    compact(`${user.lastName}${user.firstName}`),
    compact(`${user.firstName}${user.lastName}`),
    compact(user.lastName),
    compact(user.firstName),
  ];
  if (names.some((name) => name.includes(q))) return true;
  if (compact(user.username).includes(q)) return true;
  if (user.email && compact(user.email).includes(q)) return true;
  // only a phone-looking query (digits, spaces, hyphens, brackets, +) is compared with phone numbers
  if (!/^[\d\s()+-]+$/.test(query)) return false;
  const digits = digitsOnly(query);
  return digits !== "" && digitsOnly(user.phoneNumber ?? "").includes(digits);
};

// Nothing typed (empty or only spaces) is "no filter": everybody is listed.
export const searchUsers = async (query: string): Promise<User[]> => {
  const everybody = await getAllUsers();
  if (compact(query ?? "") === "") return everybody;
  return everybody.filter((user) => userMatchesQuery(user, query));
};

export const removeUserFromResults = (userId: User["id"], results: User[]): User[] =>
  results.filter((user) => user.id !== userId);

export const getFullNameForUser = async (userId: User["id"]): Promise<string> => {
  const user = await getUserById(userId);
  return user ? formatFullName(user) : "";
};
