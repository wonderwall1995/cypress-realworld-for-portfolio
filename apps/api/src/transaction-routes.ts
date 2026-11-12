///<reference path="types.ts" />

import express from "express";
import { remove, isEmpty } from "lodash/fp";
import {
  createTransaction,
  getPublicTransactionsDefaultSort,
  getTransactionByIdForApi,
  getTransactionsForUserForApi,
  getPublicTransactionsByQuery,
  attachViewerAccount,
} from "./transaction-db";
import { asyncHandler } from "./async-handler";
import { passwordMatches } from "./account-money";
import { HttpError } from "./http-error";
import { getViewableTransaction } from "./transaction-access";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import {
  sanitizeTransactionStatus,
  isTransactionQSValidator,
  isTransactionPayloadValidator,
  shortIdValidation,
  isTransactionPublicQSValidator,
} from "./validators";
import { getPaginatedItems } from "@rwa/shared";
const router = express.Router();

// Routes

//GET /transactions - scoped user, auth-required
router.get(
  "/",
  ensureAuthenticated,
  validateMiddleware([sanitizeTransactionStatus, ...isTransactionQSValidator]),
  asyncHandler(async (req, res) => {
    /* istanbul ignore next */
    const transactions = await getTransactionsForUserForApi(req.user?.id!, req.query);

    const { totalPages, data: paginatedItems } = getPaginatedItems(
      req.query.page as unknown as number,
      req.query.limit as unknown as number,
      transactions
    );

    res.status(200);
    res.json({
      pageData: {
        page: res.locals.paginate.page,
        limit: res.locals.paginate.limit,
        hasNextPages: res.locals.paginate.hasNextPages(totalPages),
        totalPages,
      },
      results: await attachViewerAccount(paginatedItems as { id: string }[], req.user?.id!),
    });
  })
);

//GET /transactions/public - auth-required
router.get(
  "/public",
  ensureAuthenticated,
  validateMiddleware(isTransactionPublicQSValidator),
  asyncHandler(async (req, res) => {
    /* istanbul ignore next */
    const transactions = !isEmpty(req.query)
      ? await getPublicTransactionsByQuery(req.user?.id!, req.query)
      : /* istanbul ignore next */
        await getPublicTransactionsDefaultSort(req.user?.id!);

    const { totalPages, data: paginatedItems } = getPaginatedItems(
      req.query.page as unknown as number,
      req.query.limit as unknown as number,
      transactions
    );

    res.status(200);
    res.json({
      pageData: {
        page: res.locals.paginate.page,
        limit: res.locals.paginate.limit,
        hasNextPages: res.locals.paginate.hasNextPages(totalPages),
        totalPages,
      },
      results: await attachViewerAccount(paginatedItems as { id: string }[], req.user?.id!),
    });
  })
);

//POST /transactions - scoped-user
router.post(
  "/",
  ensureAuthenticated,
  validateMiddleware(isTransactionPayloadValidator),
  asyncHandler(async (req, res) => {
    const transactionPayload = req.body;
    const transactionType = transactionPayload.transactionType;
    const { password } = transactionPayload;

    remove("transactionType", transactionPayload);
    delete transactionPayload.password;

    // money leaves the sender's account: the sender must type their own password again
    if (transactionType === "payment" && !(await passwordMatches(req.user?.id!, password))) {
      throw new HttpError(403, "the password is not correct");
    }

    /* istanbul ignore next */
    const transaction = await createTransaction(req.user?.id!, transactionType, transactionPayload);

    res.status(200);
    res.json({ transaction });
  })
);

//GET /transactions/:transactionId - scoped-user
router.get(
  "/:transactionId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("transactionId")]),
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;

    // 404 when the transaction does not exist or the member may not see it
    await getViewableTransaction(req.user?.id, transactionId);
    const transaction = await getTransactionByIdForApi(transactionId);

    res.status(200);
    res.json({ transaction: (await attachViewerAccount([transaction!], req.user?.id!))[0] });
  })
);

export default router;
