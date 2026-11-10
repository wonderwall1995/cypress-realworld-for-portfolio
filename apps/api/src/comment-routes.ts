///<reference path="types.ts" />

import express from "express";
import { getCommentsByTransactionId } from "./comment-db";
import { createComments } from "./social-db";
import { asyncHandler } from "./async-handler";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { getViewableTransaction } from "./transaction-access";
import { shortIdValidation, isCommentValidator } from "./validators";
const router = express.Router();

// Routes

//GET /comments/:transactionId
router.get(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    // 404 when the member may not see the transaction
    await getViewableTransaction(req.user?.id, transactionId);
    const comments = await getCommentsByTransactionId(transactionId);

    res.status(200);
    res.json({ comments });
  })
);

//POST /comments/:transactionId
router.post(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId"), isCommentValidator]),
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const { content } = req.body;

    // 404 when the member may not see the transaction
    await getViewableTransaction(req.user?.id, transactionId);

    /* istanbul ignore next */
    await createComments(req.user?.id!, transactionId, content);

    res.sendStatus(200);
  })
);

export default router;
