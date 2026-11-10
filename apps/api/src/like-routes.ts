///<reference path="types.ts" />

import express from "express";
import { getLikesByTransactionId } from "./like-db";
import { createLikes } from "./social-db";
import { asyncHandler } from "./async-handler";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { getViewableTransaction } from "./transaction-access";
import { shortIdValidation } from "./validators";
const router = express.Router();

// Routes

//GET /likes/:transactionId
router.get(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    // 404 when the member may not see the transaction
    await getViewableTransaction(req.user?.id, transactionId);
    const likes = await getLikesByTransactionId(transactionId);

    res.status(200);
    res.json({ likes });
  })
);

//POST /likes/:transactionId
router.post(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    // 404 when the member may not see the transaction
    await getViewableTransaction(req.user?.id, transactionId);
    /* istanbul ignore next */
    await createLikes(req.user?.id!, transactionId);

    res.sendStatus(200);
  })
);

export default router;
