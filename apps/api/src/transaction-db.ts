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
  Like,
  Comment,
  PaymentNotificationStatus,
  Transaction,
  TransactionPayload,
  TransactionAmountFilterPayload,
  TransactionQueryPayload,
  TransactionRequestStatus,
  TransactionResponseItem,
  TransactionStatus,
  User,
} from "@rwa/shared";
import {
  getAmountQueryFields,
  getChargeAmount,
  getDateQueryFields,
  getPayAppCreditedAmount,
  getQueryWithoutFilterFields,
  getTransferAmount,
  hasAmountQueryFields,
  matchesDirectionAmountFilter,
  hasDateQueryFields,
  hasSufficientFunds,
  isPayment,
  isRequestTransaction,
  isValidAmountDollars,
  MAX_AMOUNT_DOLLARS,
  MAX_BALANCE_CENTS,
} from "@rwa/shared";
import { canViewTransaction } from "./access";
import { createBankTransfer } from "./banktransfer-db";
import { HttpError } from "./http-error";
import { getContactIdsForUser } from "./contact-db";
import { createPaymentNotification } from "./notification-db";

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
    requestStatus: row.requestStatus || undefined,
    requestResolvedAt: row.requestResolvedAt || undefined,
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
 * "Equal" filters from the query (status, requestStatus, privacyLevel).
 * receiverId and senderId are NOT accepted here: the list is always about the given user.
 * (The old code let them replace the user's id, so a member could list someone else's transactions.)
 * Returns null when a value can never match (the old code returned an empty list then).
 */
const equalFilters = (query?: object): Record<string, string> | null => {
  const fields = (
    query ? getQueryWithoutFilterFields(query as TransactionQueryPayload) : {}
  ) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["status", "requestStatus", "privacyLevel"]) {
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
      senderName: fullName(sender),
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

// ---------------------------------------------------------------- feeds

/**
 * Transactions of the user's contacts: each contact's list (newest first), joined, no duplicates.
 * A contact's private transactions are left out (see canViewTransaction). Both the Friends tab
 * and the contact part of the Everyone tab use this function.
 */
export const getTransactionsForUserContacts = async (
  userId: string,
  query?: object
): Promise<TransactionResponseItem[]> => {
  const contactIds = await getContactIdsForUser(userId);
  const lists: TransactionResponseItem[][] = [];
  for (const contactId of contactIds) {
    // the date filter is applied per friend; the amount filter belongs to the signed-in user, so it comes after
    lists.push(await getTransactionsForUserForApi(contactId, query, false));
  }
  const visible = uniqBy("id", lists.flat()).filter((t) =>
    canViewTransaction(userId, t, contactIds)
  );
  return applyAmountFilter(visible, userId, query);
};

const getNonContactPublicTransactionsForApi = async (
  userId: string
): Promise<TransactionResponseItem[]> => {
  const contactsTransactionIds = new Set(
    (await getTransactionsForUserContacts(userId)).map((t) => t.id)
  );
  const publicTransactions = (await getAllPublicTransactions()).filter(
    (t) => !contactsTransactionIds.has(t.id)
  );
  return formatTransactionsForApiResponse(publicTransactions);
};

export const getPublicTransactionsDefaultSort = async (userId: string) => ({
  contactsTransactions: await getTransactionsForUserContacts(userId),
  publicTransactions: await getNonContactPublicTransactionsForApi(userId),
});

export const getPublicTransactionsByQuery = async (
  userId: string,
  query: TransactionQueryPayload
) => {
  if (query && (hasDateQueryFields(query) || hasAmountQueryFields(query))) {
    const publicTransactions = await getNonContactPublicTransactionsForApi(userId);

    return {
      contactsTransactions: await getTransactionsForUserContacts(userId, query),
      publicTransactions: applyAmountFilter(
        applyDateFilter(publicTransactions, query),
        userId,
        query
      ),
    };
  }
  return getPublicTransactionsDefaultSort(userId);
};

// ---------------------------------------------------------------- money movement (inside one DB transaction)

type Balanced = Pick<User, "id" | "balance">;

const saveBalance = (tx: DbClient, userId: string, balance: number) =>
  tx.user.update({ where: { id: userId }, data: { balance } });

/**
 * The payer's balance goes down. If it is not enough, the missing part is taken from the
 * bank account (a completed withdrawal) and the balance becomes 0.
 */
const debitPayAppBalance = async (tx: DbClient, user: Balanced, transaction: Transaction) => {
  if (hasSufficientFunds(user as User, transaction)) {
    await saveBalance(tx, user.id, getChargeAmount(user as User, transaction));
    return;
  }
  const transferAmount = getTransferAmount(user as User, transaction);
  if (transferAmount > 0) {
    await createBankTransfer(
      {
        userId: user.id,
        source: transaction.source,
        amount: transferAmount,
        type: BankTransferType.withdrawal,
        transactionId: transaction.id,
        status: "completed",
        balanceBefore: user.balance,
        balanceAfter: 0,
        note: "withdrawal to cover a payment",
      },
      tx
    );
  }
  await saveBalance(tx, user.id, 0);
};

const creditPayAppBalance = (tx: DbClient, user: Balanced, transaction: Transaction) => {
  const newBalance = getPayAppCreditedAmount(user as User, transaction);
  // the balance column is a 32-bit number: refuse instead of failing inside the database
  if (newBalance > MAX_BALANCE_CENTS) {
    throw new HttpError(400, "the receiver's balance would be too large");
  }
  return saveBalance(tx, user.id, newBalance);
};

export const createTransaction = (
  userId: User["id"],
  transactionType: "payment" | "request",
  transactionDetails: TransactionPayload
): Promise<Transaction> =>
  prisma.$transaction(async (tx) => {
    // a payment or request is a whole number of dollars, 1 or more (never 0 or negative)
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

    const now = new Date();
    const row = await tx.transaction.create({
      data: {
        id: shortid(),
        uuid: v4(),
        source: transactionDetails.source ?? "",
        amount: transactionDetails.amount * 100,
        description: transactionDetails.description,
        receiverId: transactionDetails.receiverId,
        senderId: userId,
        privacyLevel: transactionDetails.privacyLevel || sender.defaultPrivacyLevel || "public",
        status: TransactionStatus.pending,
        requestStatus: transactionType === "request" ? TransactionRequestStatus.pending : "",
        requestResolvedAt: "",
        createdAt: now,
        modifiedAt: now,
      },
    });
    const transaction = toTransaction(row);

    if (isPayment(transaction)) {
      // balances are read before any change, like the old code (matters when sender == receiver)
      await debitPayAppBalance(tx, sender, transaction);
      await creditPayAppBalance(tx, receiver, transaction);
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.complete },
      });
      await createPaymentNotification(
        transaction.receiverId,
        transaction.id,
        PaymentNotificationStatus.received,
        tx
      );
    } else {
      await createPaymentNotification(
        transaction.receiverId,
        transaction.id,
        PaymentNotificationStatus.requested,
        tx
      );
    }

    return toTransaction((await tx.transaction.findUnique({ where: { id: transaction.id } }))!);
  });

// Only these fields can be edited through the API.
const EDITABLE = ["requestStatus", "status", "requestResolvedAt"] as const;

/**
 * Edit a transaction.
 *
 * A request can be resolved once, while its requestStatus is "pending":
 *  - accepted: the receiver pays the sender, the transaction becomes complete, the sender is notified
 *  - rejected: only requestStatus changes. No money moves and the transaction stays pending
 * A request that is already accepted or rejected cannot be changed again (409), so the same
 * request can never move money twice. Payments only get the edited fields.
 */
export const updateTransactionById = (
  transactionId: string,
  edits: Partial<Transaction>
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    const row = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!row) throw new Error(`transaction not found: ${transactionId}`);
    const transaction = toTransaction(row);

    const sender = await tx.user.findUnique({ where: { id: transaction.senderId } });
    const receiver = await tx.user.findUnique({ where: { id: transaction.receiverId } });

    const data: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (edits[key] !== undefined) data[key] = edits[key];
    }

    if (isRequestTransaction(transaction)) {
      if (transaction.requestStatus !== TransactionRequestStatus.pending) {
        throw new HttpError(409, `this request is already ${transaction.requestStatus}`);
      }

      if (edits.requestStatus === TransactionRequestStatus.accepted && sender && receiver) {
        await debitPayAppBalance(tx, receiver, transaction);
        await creditPayAppBalance(tx, sender, transaction);
        data.status = TransactionStatus.complete;
        await createPaymentNotification(
          transaction.senderId,
          transaction.id,
          PaymentNotificationStatus.received,
          tx
        );
      }
    }

    await tx.transaction.update({ where: { id: transactionId }, data });
  });
