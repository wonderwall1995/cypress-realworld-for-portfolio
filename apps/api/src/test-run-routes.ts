/**
 * Run numbers and fixtures for the test runners (Playwright, Wdio). Open in every NODE_ENV, also production:
 * the App tests talk to the deployed server. Everything except /latest needs the secret (see test-run-secret.ts).
 */
import express from "express";
import { body, param, query } from "express-validator";
import { asyncHandler } from "./async-handler";
import { validateMiddleware } from "./helpers";
import { getTestRunSecret, hasTestRunSecret } from "./test-run-secret";
import {
  getLatestPublicFixtures,
  getRunFixtures,
  listRuns,
  reportRun,
  RunEvent,
  startRun,
} from "./test-run-db";

const router = express.Router();

// GET /testRuns/latest - for everyone: the values of the newest number, without usernames and passwords
router.get(
  "/latest",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await getLatestPublicFixtures());
  })
);

// ---- from here on the secret is needed ----
router.use((req, res, next) => {
  const secret = getTestRunSecret();
  if (!secret) return res.status(404).json({ error: "not found" }); // closed on this server
  if (!hasTestRunSecret(req.headers.authorization, secret)) {
    return res.status(401).json({ error: "the test-run secret is missing or wrong" });
  }
  res.locals.testRunSecret = secret;
  next();
});

const PLATFORMS = ["web", "app"];
const platformInBody = body("platform").isIn(PLATFORMS).withMessage("platform must be web or app");
const runNoInPath = param("runNo").isInt({ min: 1, max: 2_147_483_647 }).toInt();

// POST /testRuns { platform, device? } - joins the newest number or opens the next one
router.post(
  "/",
  validateMiddleware([
    platformInBody,
    body("device").optional().isString().trim().isLength({ max: 100 }),
  ]),
  asyncHandler(async (req, res) => {
    const { platform, device } = req.body;
    const started = await startRun(platform, device, res.locals.testRunSecret);
    res.status(started.opened ? 201 : 200).json(started);
  })
);

// GET /testRuns - every number, newest first
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.status(200).json({ runs: await listRuns() });
  })
);

// GET /testRuns/:runNo/fixtures?platform=web - the values of one number, as that platform used them
router.get(
  "/:runNo/fixtures",
  validateMiddleware([
    runNoInPath,
    query("platform").isIn(PLATFORMS).withMessage("platform must be web or app"),
  ]),
  asyncHandler(async (req, res) => {
    const runNo = Number(req.params.runNo);
    const platform = req.query.platform as "web" | "app";
    const fixtures = await getRunFixtures(runNo, platform, res.locals.testRunSecret);
    res.status(200).json({ runNo, fixtures });
  })
);

// POST /testRuns/:runNo/signal | finish | block { platform }
router.post(
  "/:runNo/:event(signal|finish|block)",
  validateMiddleware([runNoInPath, platformInBody]),
  asyncHandler(async (req, res) => {
    const runNo = Number(req.params.runNo);
    res.status(200).json(await reportRun(runNo, req.body.platform, req.params.event as RunEvent));
  })
);

export default router;
