///<reference path="types.ts" />

import express from "express";

import {
  getBankAccountsByUserId,
  getBankAccountById,
  createBankAccountForUser,
  removeBankAccountById,
} from "./bankaccount-db";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { HttpError } from "./http-error";
import { shortIdValidation, isBankAccountValidator } from "./validators";
const router = express.Router();

// Routes

//GET /bankAccounts (scoped-user)
router.get("/", ensureAuthenticated, async (req, res, next) => {
  try {
    const accounts = await getBankAccountsByUserId(req.user?.id!);

    res.status(200);
    res.json({ results: accounts });
  } catch (err) {
    next(err);
  }
});

//GET /bankAccounts/of-user/:userId - the bank accounts another member can be paid into.
// Only the bank name and the last 4 digits are shown, never the full number or the balance.
router.get(
  "/of-user/:userId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("userId")]),
  async (req, res, next) => {
    try {
      const accounts = await getBankAccountsByUserId(req.params.userId);
      res.status(200);
      res.json({
        results: accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumberLast4: a.accountNumber.slice(-4),
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

//GET /bankAccounts/:bankAccountId (scoped-user)
router.get(
  "/:bankAccountId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("bankAccountId")]),
  async (req, res, next) => {
    try {
      const { bankAccountId } = req.params;

      const found = await getBankAccountById(bankAccountId);

      // someone else's account looks the same as one that does not exist
      const account = found && found.userId === req.user?.id ? found : undefined;

      res.status(200);
      res.json({ account });
    } catch (err) {
      next(err);
    }
  }
);

//POST /bankAccounts (scoped-user)
router.post(
  "/",
  ensureAuthenticated,
  validateMiddleware(isBankAccountValidator),
  async (req, res, next) => {
    try {
      const account = await createBankAccountForUser(req.user?.id!, req.body);

      res.status(200);
      res.json({ account });
    } catch (err) {
      next(err);
    }
  }
);

//DELETE (soft) /bankAccounts (scoped-user)
router.delete(
  "/:bankAccountId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("bankAccountId")]),
  async (req, res, next) => {
    try {
      const { bankAccountId } = req.params;

      // someone else's account looks the same as one that does not exist
      const removed = await removeBankAccountById(req.user?.id!, bankAccountId);
      if (!removed) throw new HttpError(404, "bank account not found");

      res.status(200);
      res.json({});
    } catch (err) {
      next(err);
    }
  }
);

export default router;
