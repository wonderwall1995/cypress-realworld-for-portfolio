///<reference path="types.ts" />

import express from "express";

import { getBankTransfersByUserId } from "./banktransfer-db";
import { asyncHandler } from "./async-handler";
import { ensureAuthenticated } from "./helpers";
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

export default router;
