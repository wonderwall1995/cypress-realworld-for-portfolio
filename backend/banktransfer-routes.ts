///<reference path="types.ts" />

import express from "express";

import {
  getBankTransferById,
  getBankTransferLogs,
  getBankTransfersByUserId,
} from "./banktransfer-db";
import { moveMoney } from "./banktransfer-service";
import { asyncHandler } from "./async-handler";
import { HttpError } from "./http-error";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { isBankTransferValidator, shortIdValidation } from "./validators";
const router = express.Router();

// Routes

//GET /bankTransfers (scoped-user)
router.get(
  "/",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    /* istanbul ignore next */
    const transfers = await getBankTransfersByUserId(req.user?.id!);

    res.status(200);
    res.json({ transfers });
  })
);

//POST /bankTransfers (scoped-user) - virtual deposit or withdrawal, completed right away
router.post(
  "/",
  ensureAuthenticated,
  validateMiddleware(isBankTransferValidator),
  asyncHandler(async (req, res) => {
    const { bankAccountId, amount, type } = req.body;

    const transfer = await moveMoney(req.user?.id!, { bankAccountId, amount, type });

    res.status(201);
    res.json({ transfer });
  })
);

//GET /bankTransfers/:transferId/logs (scoped-user) - status history of one transfer
router.get(
  "/:transferId/logs",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transferId")]),
  asyncHandler(async (req, res) => {
    const transfer = await getBankTransferById(req.params.transferId);

    // someone else's transfer looks the same as one that does not exist
    if (!transfer || transfer.userId !== req.user?.id) {
      throw new HttpError(404, "bank transfer not found");
    }

    res.status(200);
    res.json({ logs: await getBankTransferLogs(transfer.id) });
  })
);

export default router;
