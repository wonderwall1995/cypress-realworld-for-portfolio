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
import { filter, inRange, uniqBy } from "lodash/fp";
import { isWithinInterval } from "date-fns";
import type { Transaction as TransactionRow } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import {
  BankTransferType,
  Like,
  Comment,
  PaymentNotificationStatus,
  Transaction,
  TransactionPayload,
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
  hasDateQueryFields,
  hasSufficientFunds,
  isPayment,
  isRequestTransaction,
} from "@rwa/shared";
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

export const transactionsWithinAmountRange = (
  amountMin: number,
  amountMax: number,
  transactions: Transaction[]
): Transaction[] => {
  if (!amountMin || !amountMax) return transactions;
  return filter(
    (transaction: Transaction) => inRange(amountMin, amountMax, transaction.amount),
    transactions
  );
};

export const transactionsWithinDateRange = (
  dateRangeStart: string,
  dateRangeEnd: string,
  transactions: Transaction[]
): Transaction[] => {
  if (!dateRangeStart || !dateRangeEnd) return transactions;
  return filter(
    (transaction: Transaction) =>
      isWithinInterval(new Date(transaction.createdAt), {
        start: new Date(dateRangeStart),
        end: new Date(dateRangeEnd),
      }),
    transactions
  );
};

const STATUS_VALUES = Object.values(TransactionStatus) as string[];
const PRIVACY_VALUES = ["public", "private", "contacts"];

/**
 * "Equal" filters from the query (status, requestStatus, privacyLevel, receiverId, senderId).
 * The query's receiverId / senderId replace the signed-in user's id, as in the old code.
 * Returns null when a value can never match (the old code returned an empty list then).
 */
const equalFilters = (query?: object): Record<string, string> | null => {
  const fields = (
    query ? getQueryWithoutFilterFields(query as TransactionQueryPayload) : {}
  ) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["status", "requestStatus", "privacyLevel", "receiverId", "senderId"]) {
    const value = fields[key];
    if (value === undefined || value === "") continue;
    if (key === "status" && !STATUS_VALUES.includes(String(value))) return null;
    if (key === "privacyLevel" && !PRIVACY_VALUES.includes(String(value))) return null;
    out[key] = String(value);
  }
  return out;
};

const applyRangeFilters = (transactions: Transaction[], query?: object): Transaction[] => {
  if (query && (hasDateQueryFields(query as any) || hasAmountQueryFields(query as any))) {
    const { dateRangeStart, dateRangeEnd } = getDateQueryFields(query as any);
    const { amountMin, amountMax } = getAmountQueryFields(query as any);
    return transactionsWithinAmountRange(
      amountMin!,
      amountMax!,
      transactionsWithinDateRange(dateRangeStart!, dateRangeEnd!, transactions)
    );
  }
  return transactions;
};

/** Transactions where the user is the receiver or the sender, without duplicates. */
export const getTransactionsForUserByObj = async (
  userId: string,
  query?: object
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
  return applyRangeFilters(found, query);
};

// ---------------------------------------------------------------- API response shape

const fullName = (user?: { firstName: string; lastName: string }) =>
  user ? `${user.firstName} ${user.lastName}` : "";

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
  query?: object
): Promise<TransactionResponseItem[]> =>
  formatTransactionsForApiResponse(await getTransactionsForUserByObj(userId, query));

// ---------------------------------------------------------------- feeds

/** Transactions of the user's contacts: each contact's list (newest first), joined, no duplicates. */
export const getTransactionsForUserContacts = async (
  userId: string,
  query?: object
): Promise<TransactionResponseItem[]> => {
  const contactIds = await getContactIdsForUser(userId);
  const lists: TransactionResponseItem[][] = [];
  for (const contactId of contactIds) {
    lists.push(await getTransactionsForUserForApi(contactId, query));
  }
  return uniqBy("id", lists.flat());
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
    const { dateRangeStart, dateRangeEnd } = getDateQueryFields(query);
    const { amountMin, amountMax } = getAmountQueryFields(query);
    const publicTransactions = await getNonContactPublicTransactionsForApi(userId);

    return {
      contactsTransactions: await getTransactionsForUserContacts(userId, query),
      publicTransactions: transactionsWithinAmountRange(
        amountMin!,
        amountMax!,
        transactionsWithinDateRange(dateRangeStart!, dateRangeEnd!, publicTransactions as any)
      ) as TransactionResponseItem[],
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

const creditPayAppBalance = (tx: DbClient, user: Balanced, transaction: Transaction) =>
  saveBalance(tx, user.id, getPayAppCreditedAmount(user as User, transaction));

export const createTransaction = (
  userId: User["id"],
  transactionType: "payment" | "request",
  transactionDetails: TransactionPayload
): Promise<Transaction> =>
  prisma.$transaction(async (tx) => {
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
