///<reference path="types.ts" />

import express from "express";
import { getAllForEntity, resetDatabase, TestDataEntity } from "./testdata-db";
import { asyncHandler } from "./async-handler";
import { validateMiddleware } from "./helpers";
import { isValidEntityValidator } from "./validators";
const router = express.Router();

// Routes

//POST /testData/reset - empties every table (there is no sample data)
router.post(
  "/reset",
  asyncHandler(async (req, res) => {
    await resetDatabase();
    res.sendStatus(200);
  })
);

//POST /testData/seed - same as /reset, kept for old test code that called it
router.post(
  "/seed",
  asyncHandler(async (req, res) => {
    await resetDatabase();
    res.sendStatus(200);
  })
);

//GET /testData/:entity
router.get(
  "/:entity",
  validateMiddleware([...isValidEntityValidator]),
  asyncHandler(async (req, res) => {
    const { entity } = req.params;
    const results = await getAllForEntity(entity as TestDataEntity);

    res.status(200);
    res.json({ results });
  })
);

export default router;
