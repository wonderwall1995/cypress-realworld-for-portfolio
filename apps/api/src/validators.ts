import { body, check, oneOf, query, sanitizeQuery } from "express-validator";
import { isValid } from "shortid";
import {
  TransactionStatus,
  TransactionRequestStatus,
  DefaultPrivacyLevel,
  NotificationsType,
} from "@rwa/shared";
import { includes } from "lodash/fp";
import {
  ACCOUNT_NUMBER_PATTERN,
  MAX_AMOUNT_DOLLARS,
  MAX_BALANCE_CENTS,
  PHONE_NUMBER_PATTERN,
} from "@rwa/shared";

const TransactionStatusValues = Object.values(TransactionStatus);
const RequestStatusValues = Object.values(TransactionRequestStatus);
const DefaultPrivacyLevelValues = Object.values(DefaultPrivacyLevel);
const NotificationsTypeValues = Object.values(NotificationsType);

// Validators

const isShortId = (value: string) => isValid(value);

export const shortIdValidation = (key: string) => check(key).custom(isShortId);

export const searchValidation = query("q").exists();

export const userFieldsValidator = oneOf([
  check("firstName").exists(),
  check("lastName").exists(),
  check("password").exists(),
  check("avatar").exists(),
  check("defaultPrivacyLevel").exists(),
]);

// POST /bankTransfers: move whole dollars between a bank account and the app balance
export const isBankTransferValidator = [
  body("bankAccountId").custom(isShortId),
  body("amount").isInt({ min: 1 }).toInt(),
  body("type").isIn(["deposit", "withdrawal"]),
];

export const isBankAccountValidator = [
  body("bankName").isString().trim().notEmpty().withMessage("bankName is required"),
  body("accountNumber")
    .isString()
    .trim()
    .matches(ACCOUNT_NUMBER_PATTERN)
    .withMessage("accountNumber must be 9 to 12 digits"),
];

export const isUserValidator = [
  check("firstName").optional({ checkFalsy: true }).isString().trim(),
  check("lastName").optional({ checkFalsy: true }).isString().trim(),
  check("username").optional({ checkFalsy: true }).isString().trim(),
  check("password").optional({ checkFalsy: true }).isString().trim(),
  check("email").optional({ checkFalsy: true }).isString().trim(),
  check("phoneNumber")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .matches(PHONE_NUMBER_PATTERN)
    .withMessage("phoneNumber must be a valid phone number"),
  check("avatar").optional({ checkFalsy: true }).isURL().trim(),
  check("defaultPrivacyLevel")
    .optional({ checkFalsy: true })
    .isIn(["public", "private", "contacts"]),
];

// Extra rule for sign-up only: a phone number is required (settings can still change it later).
export const isSignUpValidator = [
  body("phoneNumber")
    .isString()
    .trim()
    .matches(PHONE_NUMBER_PATTERN)
    .withMessage("phoneNumber is required and must be a valid phone number"),
];

export const sanitizeTransactionStatus = sanitizeQuery("status").customSanitizer((value) => {
  /* istanbul ignore if*/
  if (includes(value, TransactionStatusValues)) {
    return value;
  }
  return;
});

// default request status to undefined if not provided
export const sanitizeRequestStatus = sanitizeQuery("requestStatus").customSanitizer((value) => {
  /* istanbul ignore if*/
  if (includes(value, RequestStatusValues)) {
    return value;
  }
  return;
});

// Filters of the transaction lists (all optional):
//  - deposit / withdrawal amounts, in cents; a minimum above its maximum is refused (equal is fine)
//  - a date range; either side may be missing, a start after the end is refused (the same day is fine)
const centsQuery = (name: string) =>
  query(name)
    .optional({ checkFalsy: true })
    .isInt({ min: 0, max: MAX_BALANCE_CENTS })
    .withMessage(`${name} must be a whole number of cents from 0`)
    .toInt();

const minNotAboveMax = (minName: string, maxName: string) =>
  query(maxName)
    .optional({ checkFalsy: true })
    .custom((max, { req }) => {
      const min = (req.query as any)[minName];
      if (min !== undefined && min !== "" && Number(min) > Number(max)) {
        throw new Error(`${minName} must not be above ${maxName}`);
      }
      return true;
    });

const isDateValue = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export const transactionFilterValidators = [
  centsQuery("depositMin"),
  centsQuery("depositMax"),
  centsQuery("withdrawalMin"),
  centsQuery("withdrawalMax"),
  minNotAboveMax("depositMin", "depositMax"),
  minNotAboveMax("withdrawalMin", "withdrawalMax"),
  query("dateRangeStart")
    .optional({ checkFalsy: true })
    .custom(isDateValue)
    .withMessage("dateRangeStart must be a date"),
  query("dateRangeEnd")
    .optional({ checkFalsy: true })
    .custom(isDateValue)
    .withMessage("dateRangeEnd must be a date")
    .custom((end, { req }) => {
      const start = (req.query as any).dateRangeStart;
      if (start && Date.parse(start) > Date.parse(end)) {
        throw new Error("dateRangeStart must not be after dateRangeEnd");
      }
      return true;
    }),
];

export const isTransactionQSValidator = [
  query("status").isIn(TransactionStatusValues).optional().trim(),
  query("requestStatus").optional({ checkFalsy: true }).isIn(RequestStatusValues).trim(),
  query("receiverId").optional({ checkFalsy: true }).isString().trim(),
  query("senderId").optional({ checkFalsy: true }).isString().trim(),
  query("rangeStartTs").optional({ checkFalsy: true }).isString().trim(),
  query("rangeEndTs").optional({ checkFalsy: true }).isString().trim(),
  ...transactionFilterValidators,
];

export const isTransactionPayloadValidator = [
  body("transactionType").isIn(["payment", "request"]).trim(),
  body("privacyLevel").optional().isIn(DefaultPrivacyLevelValues).trim(),
  body("source").optional().isString().trim(),
  body("receiverId").isString().trim(),
  body("description").isString().trim(),
  // whole dollars, 1 or more, up to what the 32-bit cents column can hold
  body("amount")
    .trim()
    .isInt({ min: 1, max: MAX_AMOUNT_DOLLARS })
    .withMessage(`amount must be a whole number of dollars from 1 to ${MAX_AMOUNT_DOLLARS}`)
    .toInt(),
];

export const isTransactionPatchValidator = [body("requestStatus").isIn(RequestStatusValues)];

export const isTransactionPublicQSValidator = [
  query("order").optional({ checkFalsy: true }).isIn(["default"]),
  ...transactionFilterValidators,
];

export const isCommentValidator = body("content").isString().trim();

export const isNotificationsBodyValidator = [
  body("items.*.type").isIn(NotificationsTypeValues).trim(),
  body("items.*.transactionId").custom(isShortId),
];

export const isNotificationPatchValidator = [body("isRead").isBoolean()];

export const isValidEntityValidator = [
  check("entity")
    .isIn([
      "users",
      "contacts",
      "bankaccounts",
      "notifications",
      "transactions",
      "likes",
      "comments",
      "banktransfers",
    ])
    .trim(),
];
