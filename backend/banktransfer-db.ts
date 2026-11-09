/**
 * Bank transfers (virtual deposit / withdrawal) stored in PostgreSQL (Prisma).
 * No real money moves: a transfer only changes balances and leaves records.
 *
 * Every transfer has a history in bank_transfer_logs. A log row is written in the
 * same database transaction as the change it describes, and is never updated or deleted.
 */
import shortid from "shortid";
import { v4 } from "uuid";
import type { BankTransfer as BankTransferRow, BankTransferLog } from "@prisma/client";
import prisma, { DbClient } from "./prisma";
import { BankTransfer, BankTransferType } from "../src/models";

export type BankTransferStatus = "requested" | "completed" | "failed" | "canceled";

export interface CreateBankTransferInput {
  userId: string;
  source: string; // bank account id
  amount: number; // cents, positive
  type: BankTransferType;
  transactionId?: string;
  status?: BankTransferStatus; // default: completed (the transfer happens immediately)
  balanceBefore?: number;
  balanceAfter?: number;
  note?: string;
}

// requested can still change; the other states are final
const ALLOWED_NEXT: Record<BankTransferStatus, BankTransferStatus[]> = {
  requested: ["completed", "failed", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

export type BankTransferWithStatus = BankTransfer & {
  status: BankTransferStatus;
  balanceBefore?: number;
  balanceAfter?: number;
};

const toTransfer = (row: BankTransferRow): BankTransferWithStatus =>
  ({
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    source: row.source,
    amount: row.amount,
    type: row.type,
    status: row.status,
    transactionId: row.transactionId ?? undefined,
    balanceBefore: row.balanceBefore ?? undefined,
    balanceAfter: row.balanceAfter ?? undefined,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  }) as BankTransferWithStatus;

export const createBankTransfer = async (
  input: CreateBankTransferInput,
  client: DbClient = prisma
): Promise<BankTransferWithStatus> => {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("amount must be a positive whole number (cents)");
  }
  const status = input.status ?? "completed";
  const now = new Date();

  const row = await client.bankTransfer.create({
    data: {
      id: shortid(),
      uuid: v4(),
      userId: input.userId,
      source: input.source,
      amount: input.amount,
      type: input.type,
      status,
      transactionId: input.transactionId,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
      createdAt: now,
      modifiedAt: now,
      // first history row: creation (from nothing to the starting status)
      logs: {
        create: {
          id: shortid(),
          userId: input.userId,
          bankAccountId: input.source,
          amount: input.amount,
          fromStatus: null,
          toStatus: status,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          note: input.note,
          createdAt: now,
        },
      },
    },
  });
  return toTransfer(row);
};

type StatusChangeDetails = { balanceBefore?: number; balanceAfter?: number; note?: string };

/** Same as changeBankTransferStatus, but inside a database transaction the caller already opened. */
export const applyBankTransferStatusChange = async (
  tx: DbClient,
  transferId: string,
  toStatus: BankTransferStatus,
  details: StatusChangeDetails = {}
): Promise<BankTransferWithStatus> => {
  {
    const current = await tx.bankTransfer.findUnique({ where: { id: transferId } });
    if (!current) throw new Error(`bank transfer not found: ${transferId}`);

    const from = current.status as BankTransferStatus;
    if (!ALLOWED_NEXT[from].includes(toStatus)) {
      throw new Error(`cannot change a ${from} transfer to ${toStatus}`);
    }

    const now = new Date();
    const updated = await tx.bankTransfer.update({
      where: { id: transferId },
      data: {
        status: toStatus,
        balanceBefore: details.balanceBefore ?? current.balanceBefore,
        balanceAfter: details.balanceAfter ?? current.balanceAfter,
        modifiedAt: now,
      },
    });
    await tx.bankTransferLog.create({
      data: {
        id: shortid(),
        bankTransferId: transferId,
        userId: current.userId,
        bankAccountId: current.source,
        amount: current.amount,
        fromStatus: from,
        toStatus,
        balanceBefore: details.balanceBefore,
        balanceAfter: details.balanceAfter,
        note: details.note,
        createdAt: now,
      },
    });
    return toTransfer(updated);
  }
};

export const changeBankTransferStatus = (
  transferId: string,
  toStatus: BankTransferStatus,
  details: StatusChangeDetails = {}
): Promise<BankTransferWithStatus> =>
  prisma.$transaction((tx) => applyBankTransferStatusChange(tx, transferId, toStatus, details));

export const getBankTransferById = async (
  id: string
): Promise<BankTransferWithStatus | undefined> => {
  const row = await prisma.bankTransfer.findUnique({ where: { id } });
  return row ? toTransfer(row) : undefined;
};

export const getBankTransfersByUserId = async (
  userId: string
): Promise<BankTransferWithStatus[]> => {
  const rows = await prisma.bankTransfer.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTransfer);
};

export const getBankTransferByTransactionId = async (
  transactionId: string
): Promise<BankTransferWithStatus | undefined> => {
  const row = await prisma.bankTransfer.findFirst({ where: { transactionId } });
  return row ? toTransfer(row) : undefined;
};

export const getBankTransferLogs = (transferId: string): Promise<BankTransferLog[]> =>
  prisma.bankTransferLog.findMany({
    where: { bankTransferId: transferId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
