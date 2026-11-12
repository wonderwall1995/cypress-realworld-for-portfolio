/**
 * Who may do what. Plain functions with no database access, so they are easy to test.
 * Routes load the data, then ask these functions. A refusal is an HttpError.
 */
import { DefaultPrivacyLevel, Transaction } from "@rwa/shared";
import { HttpError } from "./http-error";

type TransactionParties = Pick<Transaction, "senderId" | "receiverId">;
type TransactionVisibility = TransactionParties & Pick<Transaction, "privacyLevel">;

export const isTransactionParty = (userId: string | undefined, transaction: TransactionParties) =>
  !!userId && (transaction.senderId === userId || transaction.receiverId === userId);

/**
 * Who can see a transaction (its detail, comments, likes, and its place in the feed).
 *
 *   sender, receiver            always
 *   privacy "public"            every signed-in member
 *   anything else               only the sender and the receiver
 *                               ("private", and the old "contacts": there is no friends list any more)
 */
export const canViewTransaction = (
  userId: string | undefined,
  transaction: TransactionVisibility
): boolean => {
  if (isTransactionParty(userId, transaction)) return true;
  return transaction.privacyLevel === DefaultPrivacyLevel.public;
};

/**
 * Throws 404 when the transaction does not exist or the viewer may not see it.
 * A hidden transaction looks the same as one that does not exist.
 */
export const assertCanViewTransaction = (
  userId: string | undefined,
  transaction: Transaction | undefined
): Transaction => {
  if (!transaction || !canViewTransaction(userId, transaction)) {
    throw new HttpError(404, "transaction not found");
  }
  return transaction;
};
