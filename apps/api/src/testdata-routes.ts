///<reference path="types.ts" />

import express from "express";
import { getAllForEntity, resetDatabase, TestDataEntity } from "./testdata-db";
import { asyncHandler } from "./async-handler";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { isValidEntityValidator } from "./validators";
import prisma from "./prisma";
import { syncUserBalance } from "./account-money";
const router = express.Router();

// Routes

//POST /testData/reset - empties every table (there is no sample data)
router.post(
  "/reset",
  asyncHandler(async (req, res) => {
    await resetDatabase();
    res.sendStatus(200);
  })
);

//POST /testData/seed - same as /reset, kept for old test code that called it
router.post(
  "/seed",
  asyncHandler(async (req, res) => {
    await resetDatabase();
    res.sendStatus(200);
  })
);

//DELETE /testData/bankaccounts/mine - HARD delete: removes every bank account row of the logged-in user,
// also the rows that the app only hid (visible = false). The user balance goes back in step.
router.delete(
  "/bankaccounts/mine",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id!;
    const removed = await prisma.$transaction(async (tx) => {
      const result = await tx.bankAccount.deleteMany({ where: { userId } });
      await syncUserBalance(tx, userId);
      return result.count;
    });
    res.status(200).json({ deleted: removed });
  })
);

//GET /testData/:entity
router.get(
  "/:entity",
  validateMiddleware([...isValidEntityValidator]),
  asyncHandler(async (req, res) => {
    const { entity } = req.params;
    const results = await getAllForEntity(entity as TestDataEntity);

    res.status(200);
    res.json({ results });
  })
);

export default router;
