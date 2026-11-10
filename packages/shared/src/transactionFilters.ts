/**
 * Rules for the transaction list filters (date boxes, deposit / withdrawal amounts).
 * Used by the web app to read what the user typed and by the API to apply the filter,
 * so both sides always agree.
 */
import { isEmpty } from "lodash/fp";
import { Transaction, TransactionAmountFilterPayload, TransactionStatus } from "./models";
import { MAX_AMOUNT_DOLLARS } from "./limits";

// ---------------------------------------------------------------- date range typed in two boxes

/** One date box = three text fields: year, month, day. */
export type DateBox = { year: string; month: string; day: string };

export const EMPTY_DATE_BOX: DateBox = { year: "", month: "", day: "" };

export type DateRangeError =
  | "incomplete" // some of year / month / day are filled, some are not
  | "format" // year is not 4 digits, month or day is not 1-2 digits
  | "invalid-date" // for example 2026/02/30
  | "order"; // the start day is after the end day

export type DateRangeBoxName = "start" | "end";

export type DateRangeResult =
  | { ok: true; empty: true } // both boxes are empty: no filter
  | { ok: true; empty: false; dateRangeStart?: string; dateRangeEnd?: string }
  | { ok: false; error: DateRangeError; boxes: DateRangeBoxName[] }; // boxes = which box(es) to mark

type BoxParse =
  | { kind: "empty" }
  | { kind: "date"; year: number; month: number; day: number }
  | { kind: "error"; error: DateRangeError };

const parseDateBox = (box: DateBox): BoxParse => {
  const [y, m, d] = [box.year.trim(), box.month.trim(), box.day.trim()];
  if (!y && !m && !d) return { kind: "empty" };
  if (!y || !m || !d) return { kind: "error", error: "incomplete" };
  if (!/^\d{4}$/.test(y) || !/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) {
    return { kind: "error", error: "format" };
  }
  const [year, month, day] = [Number(y), Number(m), Number(d)];
  const check = new Date(year, month - 1, day);
  // new Date() rolls 02/30 over to 03/02, so a real date must come back unchanged
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
    return { kind: "error", error: "invalid-date" };
  }
  return { kind: "date", year, month, day };
};

/**
 * Start box + end box  ->  the date range of the filter.
 * The start counts from 00:00:00.000 of its day, the end until 23:59:59.999 of its day
 * (the day boundaries of the computer that typed it).
 *
 * One side may stay empty: only a start means "from that day on", only an end means "up to that day".
 * Both empty means no filter.
 *
 * Edge cases: a start day after the end day is refused ("order").
 * The same day in both boxes is fine and means exactly that one day.
 */
export const buildDateRange = (startBox: DateBox, endBox: DateBox): DateRangeResult => {
  const start = parseDateBox(startBox);
  const end = parseDateBox(endBox);

  const errors: { box: DateRangeBoxName; error: DateRangeError }[] = [];
  if (start.kind === "error") errors.push({ box: "start", error: start.error });
  if (end.kind === "error") errors.push({ box: "end", error: end.error });
  if (errors.length > 0) {
    return { ok: false, error: errors[0].error, boxes: errors.map((e) => e.box) };
  }
  if (start.kind === "empty" && end.kind === "empty") return { ok: true, empty: true };

  const from =
    start.kind === "date"
      ? new Date(start.year, start.month - 1, start.day, 0, 0, 0, 0)
      : undefined;
  const to =
    end.kind === "date" ? new Date(end.year, end.month - 1, end.day, 23, 59, 59, 999) : undefined;

  if (from && to && from.getTime() > to.getTime()) {
    return { ok: false, error: "order", boxes: ["start", "end"] };
  }
  return {
    ok: true,
    empty: false,
    dateRangeStart: from?.toISOString(),
    dateRangeEnd: to?.toISOString(),
  };
};

/** An applied date (ISO text) back to the three fields of a box, for filling the box again. */
export const dateIsoToBox = (iso?: string): DateBox => {
  if (!iso) return { ...EMPTY_DATE_BOX };
  const d = new Date(iso);
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, "0"),
    day: String(d.getDate()).padStart(2, "0"),
  };
};

// ---------------------------------------------------------------- dollar range typed as text

export type DollarRangeError =
  | "format" // not whole dollars (digits only)
  | "too-large" // above MAX_AMOUNT_DOLLARS
  | "order"; // the minimum is above the maximum

export type DollarRangeResult =
  | { ok: true; empty: true } // both boxes are empty: no filter
  | { ok: true; empty: false; minCents: number; maxCents?: number }
  | { ok: false; error: DollarRangeError };

/**
 * Two boxes of whole dollars. An empty minimum means 0, an empty maximum means "no upper limit".
 *
 * Edge cases: a minimum above the maximum (1000 ~ 100) is refused ("order").
 * The same number twice (100 ~ 100) is fine and means exactly that amount.
 */
export const parseDollarRange = (minText: string, maxText: string): DollarRangeResult => {
  const lo = minText.trim().replace(/,/g, "");
  const hi = maxText.trim().replace(/,/g, "");
  if (lo === "" && hi === "") return { ok: true, empty: true };

  for (const text of [lo, hi]) {
    if (text !== "" && !/^\d+$/.test(text)) return { ok: false, error: "format" };
  }
  const min = lo === "" ? 0 : Number(lo);
  const max = hi === "" ? undefined : Number(hi);

  if (min > MAX_AMOUNT_DOLLARS || (max !== undefined && max > MAX_AMOUNT_DOLLARS)) {
    return { ok: false, error: "too-large" };
  }
  if (max !== undefined && min > max) return { ok: false, error: "order" };

  return {
    ok: true,
    empty: false,
    minCents: min * 100,
    maxCents: max === undefined ? undefined : max * 100,
  };
};

/** Cents of an applied filter back to the text of a dollar box. An empty minimum is shown as empty (it means 0). */
export const centsToDollarText = (cents: number | undefined, emptyWhenZero = false): string =>
  cents === undefined || cents === null || (emptyWhenZero && cents === 0)
    ? ""
    : String(Math.round(cents / 100));

// ---------------------------------------------------------------- deposit / withdrawal, seen from one user

export type MoneyDirection = "in" | "out";

/**
 * Which way did the money go for this user?
 *   payment:  the sender pays the receiver
 *   request:  the receiver pays the sender (once the request is accepted)
 * "in" = the user received money (deposit), "out" = the user paid (withdrawal),
 * null = the transaction is between other people (or someone paid themselves).
 */
export const getMoneyDirection = (
  transaction: Pick<Transaction, "senderId" | "receiverId" | "requestStatus">,
  userId: string
): MoneyDirection | null => {
  if (transaction.senderId === transaction.receiverId) return null;
  const isRequest = !isEmpty(transaction.requestStatus);
  const payer = isRequest ? transaction.receiverId : transaction.senderId;
  const payee = isRequest ? transaction.senderId : transaction.receiverId;
  if (payee === userId) return "in";
  if (payer === userId) return "out";
  return null;
};

/** Money really moved only when the transaction is complete (a pending or rejected request moved nothing). */
export const isMoneySettled = (transaction: Pick<Transaction, "status">) =>
  transaction.status === TransactionStatus.complete;

export const hasDirectionAmountFilter = (filter?: TransactionAmountFilterPayload) =>
  !!filter &&
  [filter.depositMin, filter.depositMax, filter.withdrawalMin, filter.withdrawalMax].some(
    (value) => value !== undefined && value !== null
  );

/**
 * Does the transaction pass the deposit / withdrawal filter of this user? Amounts are cents, both ends included.
 *  - no filter set: everything passes
 *  - only the deposit boxes set: only money the user received, inside that range
 *  - only the withdrawal boxes set: only money the user paid, inside that range
 *  - both set: either of the two
 * Transactions between other people and unsettled requests never pass once a filter is set.
 */
export const matchesDirectionAmountFilter = (
  transaction: Pick<Transaction, "senderId" | "receiverId" | "requestStatus" | "status" | "amount">,
  userId: string,
  filter?: TransactionAmountFilterPayload
): boolean => {
  if (!filter || !hasDirectionAmountFilter(filter)) return true;

  const direction = getMoneyDirection(transaction, userId);
  if (!direction || !isMoneySettled(transaction)) return false;

  const [min, max] =
    direction === "in"
      ? [filter.depositMin, filter.depositMax]
      : [filter.withdrawalMin, filter.withdrawalMax];
  if (min === undefined && max === undefined) return false; // this kind was not asked for

  return transaction.amount >= (min ?? 0) && (max === undefined || transaction.amount <= max);
};
