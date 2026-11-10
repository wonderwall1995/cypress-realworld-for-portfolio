/**
 * Who may do what. Plain functions with no database access, so they are easy to test.
 * Routes load the data, then ask these functions. A refusal is an HttpError.
 */
import { DefaultPrivacyLevel, isRequestTransaction, Transaction } from "@rwa/shared";
import { HttpError } from "./http-error";

type TransactionParties = Pick<Transaction, "senderId" | "receiverId">;
type TransactionVisibility = TransactionParties & Pick<Transaction, "privacyLevel">;

export const isTransactionParty = (userId: string | undefined, transaction: TransactionParties) =>
  !!userId && (transaction.senderId === userId || transaction.receiverId === userId);

/**
 * Who can see a transaction (its detail, comments, likes, and its place in the feeds).
 *
 *   sender, receiver            always
 *   privacy "public"            every signed-in member
 *   privacy "contacts"          members who have the sender or the receiver in their contact list
 *   privacy "private" (or any   only the sender and the receiver
 *   unknown value)
 *
 * `viewerContactIds` are the ids in the viewer's own contact list.
 */
export const canViewTransaction = (
  userId: string | undefined,
  transaction: TransactionVisibility,
  viewerContactIds: readonly string[]
): boolean => {
  if (isTransactionParty(userId, transaction)) return true;
  if (transaction.privacyLevel === DefaultPrivacyLevel.public) return true;
  if (transaction.privacyLevel === DefaultPrivacyLevel.contacts) {
    return (
      viewerContactIds.includes(transaction.senderId) ||
      viewerContactIds.includes(transaction.receiverId)
    );
  }
  return false;
};

/**
 * Throws 404 when the transaction does not exist or the viewer may not see it.
 * A hidden transaction looks the same as one that does not exist.
 */
export const assertCanViewTransaction = (
  userId: string | undefined,
  transaction: Transaction | undefined,
  viewerContactIds: readonly string[]
): Transaction => {
  if (!transaction || !canViewTransaction(userId, transaction, viewerContactIds)) {
    throw new HttpError(404, "transaction not found");
  }
  return transaction;
};

/**
 * Who can answer (accept or reject) a request.
 * In a request, the sender asks and the receiver is the one asked to pay. Only the receiver answers.
 * Without this rule, any signed-in member could accept a request and move another member's money.
 *
 *   404  no such transaction, or the member is not in it (looks the same as "does not exist")
 *   400  the transaction is a payment, not a request
 *   403  the member is the sender (the one who asked)
 */
export const assertCanAnswerRequest = (
  userId: string | undefined,
  transaction: Transaction | undefined
): void => {
  if (!transaction || !isTransactionParty(userId, transaction)) {
    throw new HttpError(404, "transaction not found");
  }
  if (!isRequestTransaction(transaction)) {
    throw new HttpError(400, "only a request can be answered");
  }
  if (transaction.receiverId !== userId) {
    throw new HttpError(403, "only the member who was asked can answer a request");
  }
};
