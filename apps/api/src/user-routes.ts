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
import { passwordMatches } from "./account-money";
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

//POST /users/verifyPassword - scoped-user: is this the signed-in member's own password?
// Used by the "are you sure?" step before money is moved. 204 yes, 403 no.
router.post(
  "/verifyPassword",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    if (!(await passwordMatches(req.user?.id!, req.body?.password))) {
      throw new HttpError(403, "the password is not correct");
    }
    res.sendStatus(204);
  })
);

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

// E-mail and phone number may be left empty. Spaces only count as empty.
const trimEmptyableFields: express.RequestHandler = (req, _res, next) => {
  for (const key of ["email", "phoneNumber"]) {
    if (typeof req.body?.[key] === "string") req.body[key] = req.body[key].trim();
  }
  next();
};

router.patch(
  "/:userId",
  ensureAuthenticated,
  trimEmptyableFields,
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

    // An empty e-mail or phone number clears the value (stored as null).
    const wanted: Record<string, unknown> = { ...edits };
    for (const key of ["email", "phoneNumber"]) {
      if (wanted[key] === "") wanted[key] = null;
    }

    // Only what really changes is written. Nothing to change is still a success (204).
    const current = (await getUserById(userId)) as unknown as Record<string, unknown>;
    const changed = Object.fromEntries(
      Object.entries(wanted).filter(([key, value]) => (current?.[key] ?? null) !== (value ?? null))
    );
    if (Object.keys(changed).length > 0) {
      await updateUserById(userId, changed as Partial<User>);
    }

    res.sendStatus(204);
  })
);

export default router;
