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
import { omitPassword, toOtherUserResponse } from "./user-response";
import { HttpError } from "./http-error";
import { User } from "@rwa/shared";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import {
  shortIdValidation,
  searchValidation,
  userFieldsValidator,
  isUserValidator,
  isSignUpValidator,
} from "./validators";
const router = express.Router();

// Routes
router.get(
  "/",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    /* istanbul ignore next */
    const users = removeUserFromResults(req.user?.id!, await getAllUsers());
    res.status(200).json({ results: users.map((user) => toOtherUserResponse(user)) });
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

    res.status(200).json({ results: users.map((user) => toOtherUserResponse(user)) });
  })
);

router.post(
  "/",
  userFieldsValidator,
  validateMiddleware([...isUserValidator, ...isSignUpValidator]),
  asyncHandler(async (req, res) => {
    const userDetails: User = req.body;

    // A new member always starts with a balance of 0. The client cannot choose it.
    const user = await createUser({ ...userDetails, balance: 0 });

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

    // A member can only edit their own account.
    if (userId !== req.user?.id) {
      throw new HttpError(403, "you can only edit your own account");
    }

    // Only profile fields. The balance changes only through payments and bank transfers.
    const edits: Partial<User> = pick(
      ["firstName", "lastName", "email", "phoneNumber", "avatar", "defaultPrivacyLevel"],
      req.body
    );

    await updateUserById(userId, edits);

    res.sendStatus(204);
  })
);

export default router;
