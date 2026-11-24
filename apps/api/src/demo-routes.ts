/**
 * Routes that the web demo (the in-browser test run) needs. Unlike /testData, they are open in every
 * NODE_ENV (also production), so they are safe on purpose: every route needs a login and works only
 * on the bank accounts of the logged-in user. They never touch another user's data.
 */
import express from "express";
import prisma from "./prisma";
import { ensureAuthenticated } from "./helpers";
import { asyncHandler } from "./async-handler";
import { lockUsers, syncUserBalance } from "./account-money";

const router = express.Router();

// GET /demo/bankaccounts/count - how many bank account rows the user has in the database,
// also the rows that the app only hid (visible = false)
router.get(
  "/bankaccounts/count",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id!;
    const total = await prisma.bankAccount.count({ where: { userId } });
    const visible = await prisma.bankAccount.count({ where: { userId, visible: true } });
    res.status(200).json({ total, visible, hidden: total - visible });
  })
);

// DELETE /demo/bankaccounts - HARD delete: removes every bank account row of the user (also the hidden ones).
// The user balance goes back in step.
router.delete(
  "/bankaccounts",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id!;
    const deleted = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      const result = await tx.bankAccount.deleteMany({ where: { userId } });
      await syncUserBalance(tx, userId);
      return result.count;
    });
    res.status(200).json({ deleted });
  })
);

export default router;
