/**
 * The database side of the visibility rule: load what the rule needs, then ask it (see access.ts).
 * Routes that work on one transaction by id call this before they read or write anything.
 */
import { Transaction } from "@rwa/shared";
import { assertCanViewTransaction } from "./access";
import { getTransactionById } from "./transaction-db";

/** Returns the transaction, or throws 404 when it does not exist or the member may not see it. */
export const getViewableTransaction = async (
  userId: string | undefined,
  transactionId: string
): Promise<Transaction> => {
  const transaction = await getTransactionById(transactionId);
  return assertCanViewTransaction(userId, transaction);
};
