/**
 * Rules for numbers that users type. One place, used by the API and by the web app,
 * so the screen and the server can never disagree.
 */

// Money is stored in cents in a 32-bit whole number (largest value 2,147,483,647).
export const MAX_BALANCE_CENTS = 2_147_483_647;

// A payment or request is typed in whole dollars; the server multiplies by 100.
// This is the largest dollar amount whose cents still fit in the 32-bit number.
export const MAX_AMOUNT_DOLLARS = 21_474_836;

/** Whole dollars, 1 or more, up to MAX_AMOUNT_DOLLARS. 0, negative, decimals, NaN: all false. */
export const isValidAmountDollars = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_AMOUNT_DOLLARS;

// Bank numbers stay text (they can start with 0, for example 021000021) but only digits are allowed.
export const ROUTING_NUMBER_PATTERN = /^\d{9}$/;
export const ACCOUNT_NUMBER_PATTERN = /^\d{9,12}$/;

export const isValidRoutingNumber = (value: unknown): value is string =>
  typeof value === "string" && ROUTING_NUMBER_PATTERN.test(value);

export const isValidAccountNumber = (value: unknown): value is string =>
  typeof value === "string" && ACCOUNT_NUMBER_PATTERN.test(value);
