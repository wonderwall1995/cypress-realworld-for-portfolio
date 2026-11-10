///<reference path="types.ts" />

import express from "express";

import { getContactsByUsername, removeContactById, createContactForUser } from "./contact-db";
import { asyncHandler } from "./async-handler";
import { HttpError } from "./http-error";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation } from "./validators";
const router = express.Router();

// Routes
//GET /contacts/:username (scoped-user) - a member can only list their own contacts
router.get(
  "/:username",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (username !== req.user?.username) {
      throw new HttpError(403, "you can only see your own contacts");
    }

    const contacts = await getContactsByUsername(username);

    res.status(200);
    res.json({ contacts });
  })
);

//POST /contacts (scoped-user)
router.post(
  "/",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("contactUserId")]),
  asyncHandler(async (req, res) => {
    const { contactUserId } = req.body;
    /* istanbul ignore next */
    const contact = await createContactForUser(req.user?.id!, contactUserId);

    res.status(200);
    res.json({ contact });
  })
);
//DELETE /contacts/:contactId (scoped-user)
router.delete(
  "/:contactId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("contactId")]),
  asyncHandler(async (req, res) => {
    const { contactId } = req.params;

    // someone else's contact looks the same as one that does not exist
    const removed = await removeContactById(req.user?.id!, contactId);
    if (!removed) throw new HttpError(404, "contact not found");

    res.status(200);
    res.json({});
  })
);

export default router;
