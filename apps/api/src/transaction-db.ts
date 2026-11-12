/**
 * Transactions (payments and requests) stored in PostgreSQL (Prisma).
 * Replaces the old JSON-file (lowdb) transaction functions.
 *
 * What changed compared with the old JSON-file (lowdb) version:
 *  - Creating or accepting a transaction moves money between two users, may create a
 *    withdrawal bank transfer and a notification. All of it runs in ONE database
 *    transaction, so a failure in the middle leaves nothing half done.
 *  - Feeds load users, likes and comments with one query each, not one query per row.
 *  - The filtering rules (equal fields, date range, amount range) are the same as before.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import { filter, uniqBy } from "lodash/fp";
import type { Transaction as TransactionRow } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import {
  BankTransferType,
  EXTERNAL_DEPOSIT_NAME,
  EXTERNAL_DEPOSIT_SENDER_ID,
  Like,
  Comment,
  NotificationType,
  PaymentNotificationStatus,
  Transaction,
  TransactionPayload,
  TransactionAmountFilterPayload,
  TransactionQueryPayload,
  TransactionResponseItem,
  TransactionStatus,
  User,
} from "@rwa/shared";
import {
  getAmountQueryFields,
  getDateQueryFields,
  getQueryWithoutFilterFields,
  hasAmountQueryFields,
  matchesDirectionAmountFilter,
  hasDateQueryFields,
  isValidAmountDollars,
  MAX_AMOUNT_DOLLARS,
  MAX_BALANCE_CENTS,
} from "@rwa/shared";
import { loadUsableAccount, moveBetweenAccounts } from "./account-money";
import { HttpError } from "./http-error";
import { createPaymentNotification } from "./notification-db";
import { publishNotifications } from "./notification-stream";

// ---------------------------------------------------------------- mapping

const toTransaction = (row: TransactionRow): Transaction =>
  ({
    id: row.id,
    uuid: row.uuid,
    source: row.source,
    amount: row.amount,
    description: row.description,
    privacyLevel: row.privacyLevel,
    receiverId: row.receiverId,
    senderId: row.senderId,
    balanceAtCompletion: row.balanceAtCompletion ?? undefined,
    status: row.status,
    // stored as "" when empty; the API omits it for payments
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  }) as Transaction;

const ORDER_STABLE = [{ createdAt: "asc" as const }, { id: "asc" as const }];

const newestFirst = <T extends { modifiedAt: Date | string }>(items: T[]): T[] =>
  [...items].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

// ---------------------------------------------------------------- basic reads

export const getAllTransactions = async (): Promise<Transaction[]> =>
  (await prisma.transaction.findMany({ orderBy: ORDER_STABLE })).map(toTransaction);

export const getAllPublicTransactions = async (): Promise<Transaction[]> =>
  (
    await prisma.transaction.findMany({ where: { privacyLevel: "public" }, orderBy: ORDER_STABLE })
  ).map(toTransaction);

export const getTransactionById = async (
  id: string,
  client: DbClient = prisma
): Promise<Transaction | undefined> => {
  const row = await client.transaction.findUnique({ where: { id } });
  return row ? toTransaction(row) : undefined;
};

// transactions where the user is the receiver (same meaning as the old helper used by tests)
export const getTransactionsByUserId = async (userId: string): Promise<Transaction[]> =>
  (await prisma.transaction.findMany({ where: { receiverId: userId }, orderBy: ORDER_STABLE })).map(
    toTransaction
  );

// ---------------------------------------------------------------- filters (same rules as before)

/**
 * Transactions created inside the date range, both ends included.
 * One side may be missing: only a start = from that moment on, only an end = up to that moment.
 * A start after the end is refused.
 */
export const transactionsWithinDateRange = <T extends Transaction>(
  dateRangeStart: string | undefined,
  dateRangeEnd: string | undefined,
  transactions: T[]
): T[] => {
  const from = dateRangeStart ? new Date(dateRangeStart).getTime() : undefined;
  const to = dateRangeEnd ? new Date(dateRangeEnd).getTime() : undefined;
  if (from === undefined && to === undefined) return transactions;
  if (from !== undefined && to !== undefined && from > to) {
    throw new HttpError(400, "dateRangeStart must not be after dateRangeEnd");
  }
  return filter((transaction: T) => {
    const created = new Date(transaction.createdAt).getTime();
    return (from === undefined || created >= from) && (to === undefined || created <= to);
  }, transactions);
};

const STATUS_VALUES = Object.values(TransactionStatus) as string[];
const PRIVACY_VALUES = ["public", "private", "contacts"];

/**
 * "Equal" filters from the query (status, privacyLevel).
 * receiverId and senderId are NOT accepted here: the list is always about the given user.
 * (The old code let them replace the user's id, so a member could list someone else's transactions.)
 * Returns null when a value can never match (the old code returned an empty list then).
 */
const equalFilters = (query?: object): Record<string, string> | null => {
  const fields = (
    query ? getQueryWithoutFilterFields(query as TransactionQueryPayload) : {}
  ) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["status", "privacyLevel"]) {
    const value = fields[key];
    if (value === undefined || value === "") continue;
    if (key === "status" && !STATUS_VALUES.includes(String(value))) return null;
    if (key === "privacyLevel" && !PRIVACY_VALUES.includes(String(value))) return null;
    out[key] = String(value);
  }
  return out;
};

const applyDateFilter = <T extends Transaction>(transactions: T[], query?: object): T[] => {
  if (query && hasDateQueryFields(query as any)) {
    const { dateRangeStart, dateRangeEnd } = getDateQueryFields(query as any);
    return transactionsWithinDateRange(dateRangeStart, dateRangeEnd, transactions);
  }
  return transactions;
};

/**
 * Deposit / withdrawal filter, always from the point of view of `viewerId` (the signed-in user).
 * (See matchesDirectionAmountFilter for the rules; a minimum above its maximum is refused.)
 */
const readAmountFilter = (query?: object): TransactionAmountFilterPayload | undefined => {
  if (!query || !hasAmountQueryFields(query as any)) return undefined;
  const raw = getAmountQueryFields(query as any) as Record<string, unknown>;
  const filter: Record<string, number> = {};
  for (const key of ["depositMin", "depositMax", "withdrawalMin", "withdrawalMax"]) {
    if (raw[key] !== undefined && raw[key] !== "") filter[key] = Number(raw[key]);
  }
  for (const [min, max] of [
    ["depositMin", "depositMax"],
    ["withdrawalMin", "withdrawalMax"],
  ]) {
    if (filter[min] !== undefined && filter[max] !== undefined && filter[min] > filter[max]) {
      throw new HttpError(400, `${min} must not be above ${max}`);
    }
  }
  return filter as TransactionAmountFilterPayload;
};

const applyAmountFilter = <T extends Transaction>(
  transactions: T[],
  viewerId: string,
  query?: object
): T[] => {
  const filter = readAmountFilter(query);
  return filter
    ? transactions.filter((t) => matchesDirectionAmountFilter(t, viewerId, filter))
    : transactions;
};

/**
 * Transactions where the user is the receiver or the sender, without duplicates.
 * `applyAmount` is false when the list is only a building block of another list
 * (the Friends tab asks for each friend's list, but the amount filter belongs to the signed-in user).
 */
export const getTransactionsForUserByObj = async (
  userId: string,
  query?: object,
  applyAmount = true
): Promise<Transaction[]> => {
  const filters = equalFilters(query);
  if (filters === null) return [];

  const asReceiver = await prisma.transaction.findMany({
    where: { receiverId: userId, ...filters } as any,
    orderBy: ORDER_STABLE,
  });
  const asSender = await prisma.transaction.findMany({
    where: { senderId: userId, ...filters } as any,
    orderBy: ORDER_STABLE,
  });

  const found = uniqBy("id", [...asReceiver, ...asSender].map(toTransaction));
  const inDateRange = applyDateFilter(found, query);
  return applyAmount ? applyAmountFilter(inDateRange, userId, query) : inDateRange;
};

// ---------------------------------------------------------------- API response shape

const fullName = (user?: { firstName: string; lastName: string }) =>
  user ? `${user.lastName} ${user.firstName}` : "";

/** Adds names, avatars, likes and comments. Three queries for the whole list. */
export const formatTransactionsForApiResponse = async (
  transactions: Transaction[],
  client: DbClient = prisma
): Promise<TransactionResponseItem[]> => {
  if (transactions.length === 0) return [];

  const userIds = [...new Set(transactions.flatMap((t) => [t.receiverId, t.senderId]))];
  const transactionIds = transactions.map((t) => t.id);

  const [users, likes, comments] = await Promise.all([
    client.user.findMany({ where: { id: { in: userIds } } }),
    client.like.findMany({
      where: { transactionId: { in: transactionIds } },
      orderBy: ORDER_STABLE,
    }),
    client.comment.findMany({
      where: { transactionId: { in: transactionIds } },
      orderBy: ORDER_STABLE,
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const likesBy = new Map<string, Like[]>();
  likes.forEach((l) => likesBy.set(l.transactionId, [...(likesBy.get(l.transactionId) ?? []), l]));
  const commentsBy = new Map<string, Comment[]>();
  comments.forEach((c) =>
    commentsBy.set(c.transactionId, [...(commentsBy.get(c.transactionId) ?? []), c])
  );

  const items = transactions.map((transaction) => {
    const receiver = userById.get(transaction.receiverId);
    const sender = userById.get(transaction.senderId);
    return {
      receiverName: fullName(receiver),
      senderName:
        transaction.senderId === EXTERNAL_DEPOSIT_SENDER_ID
          ? EXTERNAL_DEPOSIT_NAME
          : fullName(sender),
      receiverAvatar: receiver?.avatar ?? undefined,
      senderAvatar: sender?.avatar ?? undefined,
      likes: likesBy.get(transaction.id) ?? [],
      comments: commentsBy.get(transaction.id) ?? [],
      ...transaction,
    } as TransactionResponseItem;
  });
  return newestFirst(items);
};

export const getTransactionByIdForApi = async (
  id: string
): Promise<TransactionResponseItem | undefined> => {
  const transaction = await getTransactionById(id);
  return transaction ? (await formatTransactionsForApiResponse([transaction]))[0] : undefined;
};

export const getTransactionsForUserForApi = async (
  userId: string,
  query?: object,
  applyAmount = true
): Promise<TransactionResponseItem[]> =>
  formatTransactionsForApiResponse(await getTransactionsForUserByObj(userId, query, applyAmount));

// ---------------------------------------------------------------- feed

/**
 * The "전체" feed seen by one member: every public transaction, plus the member's own outside
 * deposits (those are private for everybody else). There is no friends list any more.
 * Newest first, ready for the API.
 */
const getPublicFeedForApi = async (userId: string): Promise<TransactionResponseItem[]> => {
  const myDeposits = (
    await prisma.transaction.findMany({
      where: { receiverId: userId, senderId: EXTERNAL_DEPOSIT_SENDER_ID },
      orderBy: ORDER_STABLE,
    })
  ).map(toTransaction);
  const publicTransactions = uniqBy("id", [...(await getAllPublicTransactions()), ...myDeposits]);
  return formatTransactionsForApiResponse(publicTransactions);
};

export const getPublicTransactionsDefaultSort = (userId: string) => getPublicFeedForApi(userId);

export const getPublicTransactionsByQuery = async (
  userId: string,
  query: TransactionQueryPayload
): Promise<TransactionResponseItem[]> => {
  const feed = await getPublicFeedForApi(userId);
  if (query && (hasDateQueryFields(query) || hasAmountQueryFields(query))) {
    return applyAmountFilter(applyDateFilter(feed, query), userId, query);
  }
  return feed;
};

// ---------------------------------------------------------------- bank accounts shown next to a transaction

/**
 * Adds `myAccount` to each item: the signed-in user's own bank account in that transaction
 * (name and balance right after the money moved). Nobody sees the other side's account or balance.
 */
export const attachViewerAccount = async <T extends { id: string }>(
  items: T[],
  viewerId: string
): Promise<(T & { myAccount?: { bankName: string; balanceAfter?: number } })[]> => {
  if (items.length === 0) return items;
  const rows = await prisma.transaction.findMany({
    where: { id: { in: items.map((t) => t.id) } },
    select: {
      id: true,
      source: true,
      payerAccountId: true,
      payeeAccountId: true,
      payerBalanceAfter: true,
      payeeBalanceAfter: true,
    },
  });
  const accountIds = rows
    .flatMap((r) => [r.payerAccountId, r.payeeAccountId, r.source])
    .filter(Boolean);
  const accounts = await prisma.bankAccount.findMany({
    where: { id: { in: accountIds as string[] }, userId: viewerId },
    select: { id: true, bankName: true },
  });
  const mine = new Map(accounts.map((a) => [a.id, a.bankName]));
  const byId = new Map(rows.map((r) => [r.id, r]));

  return items.map((original) => {
    const row = byId.get(original.id);
    if (!row) return original;
    // `source` is the sender's account id: only the owner may see it
    const item = row.source && !mine.has(row.source) ? { ...original, source: "" } : original;
    if (row.payeeAccountId && mine.has(row.payeeAccountId)) {
      const myAccount = {
        bankName: mine.get(row.payeeAccountId)!,
        balanceAfter: row.payeeBalanceAfter ?? undefined,
      };
      return { ...item, myAccount };
    }
    if (row.payerAccountId && mine.has(row.payerAccountId)) {
      const myAccount = {
        bankName: mine.get(row.payerAccountId)!,
        balanceAfter: row.payerBalanceAfter ?? undefined,
      };
      return { ...item, myAccount };
    }
    return item;
  });
};

// ---------------------------------------------------------------- money movement (inside one DB transaction)

export interface TransactionAccounts {
  /** my bank account: the money leaves it */
  myAccountId?: string;
  /** the receiver's bank account: the money goes into it */
  otherAccountId?: string;
}

/**
 * A transfer: money moves at once from one of my bank accounts to one of the receiver's.
 * There are no requests any more (nothing to ask, notify or accept).
 * Everything happens in ONE database transaction, so a failure leaves nothing half done.
 */
export const createTransaction = async (
  userId: User["id"],
  transactionType: "payment",
  transactionDetails: TransactionPayload & TransactionAccounts
): Promise<Transaction> => {
  const made: NotificationType[] = []; // sent to open streams only AFTER the commit
  const result = await prisma.$transaction(async (tx) => {
    if (transactionType !== "payment") {
      throw new HttpError(400, "only a transfer (payment) can be created");
    }
    // a transfer is a whole number of dollars, 1 or more (never 0 or negative)
    if (!isValidAmountDollars(transactionDetails.amount)) {
      throw new HttpError(
        400,
        "amount must be a whole number of dollars from 1 to " + MAX_AMOUNT_DOLLARS
      );
    }

    const sender = await tx.user.findUnique({ where: { id: userId } });
    const receiver = await tx.user.findUnique({ where: { id: transactionDetails.receiverId } });
    if (!sender) throw new Error(`sender not found: ${userId}`);
    if (!receiver) throw new Error(`receiver not found: ${transactionDetails.receiverId}`);

    const myAccount = await loadUsableAccount(tx, transactionDetails.myAccountId, sender.id, "my");
    const otherAccount = await loadUsableAccount(
      tx,
      transactionDetails.otherAccountId,
      receiver.id,
      "the receiver's"
    );

    const now = new Date();
    const cents = transactionDetails.amount * 100;
    const row = await tx.transaction.create({
      data: {
        id: shortid(),
        uuid: v4(),
        source: myAccount.id,
        amount: cents,
        description: transactionDetails.description,
        receiverId: transactionDetails.receiverId,
        senderId: userId,
        privacyLevel: transactionDetails.privacyLevel || sender.defaultPrivacyLevel || "public",
        status: TransactionStatus.pending,
        payerAccountId: myAccount.id,
        payeeAccountId: otherAccount.id,
        createdAt: now,
        modifiedAt: now,
      },
    });

    const after = await moveBetweenAccounts(tx, myAccount.id, otherAccount.id, cents);
    await tx.transaction.update({
      where: { id: row.id },
      data: {
        status: TransactionStatus.complete,
        payerBalanceAfter: after.payerAfter,
        payeeBalanceAfter: after.payeeAfter,
      },
    });
    made.push(
      await createPaymentNotification(
        row.receiverId,
        row.id,
        PaymentNotificationStatus.received,
        tx
      )
    );

    return toTransaction((await tx.transaction.findUnique({ where: { id: row.id } }))!);
  });

  await publishNotifications(made); // committed: tell the receiver's open streams
  return result;
};
