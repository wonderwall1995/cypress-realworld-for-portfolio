///<reference path="types.ts" />

import express from "express";

import { getContactsByUsername, removeContactById, createContactForUser } from "./contact-db";
import { asyncHandler } from "./async-handler";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import { shortIdValidation } from "./validators";
const router = express.Router();

// Routes
//GET /contacts/:username
router.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const { username } = req.params;

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

    const contacts = await removeContactById(contactId);

    res.status(200);
    res.json({ contacts });
  })
);

export default router;
