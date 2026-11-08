///<reference path="types.ts" />

import express from "express";

import {
  getBankAccountsByUserId,
  getBankAccountById,
  createBankAccountForUser,
  removeBankAccountById,
} from "./bankaccount-db";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
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

//GET /bankAccounts/:bankAccountId (scoped-user)
router.get(
  "/:bankAccountId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("bankAccountId")]),
  async (req, res, next) => {
    try {
      const { bankAccountId } = req.params;

      const account = await getBankAccountById(bankAccountId);

      res.status(200);
      res.json({ account: account ?? undefined });
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

      const account = await removeBankAccountById(bankAccountId);

      res.status(200);
      res.json({ account });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
