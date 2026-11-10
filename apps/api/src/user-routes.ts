///<reference path="types.ts" />

import express from "express";
import { isEqual, pick } from "lodash/fp";

import {
  getAllUsers,
  createUser,
  updateUserById,
  getUserById,
  getUserByUsername,
  searchUsers,
  removeUserFromResults,
} from "./user-db";
import { asyncHandler } from "./async-handler";
import { omitPassword } from "./user-response";
import { User } from "@rwa/shared";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import {
  shortIdValidation,
  searchValidation,
  userFieldsValidator,
  isUserValidator,
} from "./validators";
const router = express.Router();

// Routes
router.get(
  "/",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    /* istanbul ignore next */
    const users = removeUserFromResults(req.user?.id!, await getAllUsers());
    res.status(200).json({ results: users.map((user) => omitPassword(user)) });
  })
);

router.get(
  "/search",
  ensureAuthenticated,
  validateMiddleware([searchValidation]),
  asyncHandler(async (req, res) => {
    const { q } = req.query;

    /* istanbul ignore next */
    const users = removeUserFromResults(req.user?.id!, await searchUsers(q as string));

    res.status(200).json({ results: users.map((user) => omitPassword(user)) });
  })
);

router.post(
  "/",
  userFieldsValidator,
  validateMiddleware(isUserValidator),
  asyncHandler(async (req, res) => {
    const userDetails: User = req.body;

    const user = await createUser(userDetails);

    res.status(201);
    res.json({ user: omitPassword(user) });
  })
);

router.get(
  "/:userId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("userId")]),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Permission: account owner
    /* istanbul ignore next */
    if (!isEqual(userId, req.user?.id)) {
      return res.status(401).send({
        error: "Unauthorized",
      });
    }

    const user = await getUserById(userId);

    res.status(200);
    res.json({ user: omitPassword(user) });
  })
);

router.get(
  "/profile/:username",
  asyncHandler(async (req, res) => {
    const { username } = req.params;

    const user = pick(["firstName", "lastName", "avatar"], await getUserByUsername(username));

    res.status(200);
    res.json({ user });
  })
);

router.patch(
  "/:userId",
  ensureAuthenticated,
  userFieldsValidator,
  validateMiddleware([shortIdValidation("userId"), ...isUserValidator]),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const edits: User = req.body;

    await updateUserById(userId, edits);

    res.sendStatus(204);
  })
);

export default router;
