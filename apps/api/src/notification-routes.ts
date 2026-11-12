///<reference path="types.ts" />

import express from "express";
import { createNotifications, updateNotificationById } from "./notification-db";
import { getUnreadNotificationsForApi } from "./notification-api";
import { openNotificationStream, publishNotifications } from "./notification-stream";
import { asyncHandler } from "./async-handler";
import { ensureAuthenticated, validateMiddleware } from "./helpers";
import {
  isNotificationsBodyValidator,
  shortIdValidation,
  isNotificationPatchValidator,
} from "./validators";
const router = express.Router();

// Routes

//GET /notifications/
router.get(
  "/",
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    /* istanbul ignore next */
    const notifications = await getUnreadNotificationsForApi(req.user?.id!);

    res.status(200);
    res.json({ results: notifications });
  })
);

//GET /notifications/stream - live notifications (Server-Sent Events). See notification-stream.ts.
// 401 JSON when not signed in (the same login check as the other notification routes).
router.get("/stream", ensureAuthenticated, (req, res) => openNotificationStream(req, res));

//POST /notifications/bulk
router.post(
  "/bulk",
  ensureAuthenticated,
  validateMiddleware([...isNotificationsBodyValidator]),
  asyncHandler(async (req, res) => {
    const { items } = req.body;
    /* istanbul ignore next */
    const notifications = await createNotifications(req.user?.id!, items);
    await publishNotifications(notifications); // already committed

    res.status(200);
    // @ts-ignore
    res.json({ results: notifications });
  })
);

//PATCH /notifications/:notificationId - scoped-user
router.patch(
  "/:notificationId",
  ensureAuthenticated,
  validateMiddleware([shortIdValidation("notificationId"), ...isNotificationPatchValidator]),
  asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    /* istanbul ignore next */
    await updateNotificationById(req.user?.id!, notificationId, req.body);

    res.sendStatus(204);
  })
);

export default router;
