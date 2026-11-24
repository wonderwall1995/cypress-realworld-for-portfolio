/**
 * Run numbers and fixtures for the test runners (Playwright, Wdio). Open in every NODE_ENV, also production:
 * the App tests talk to the deployed server. Everything except /latest needs the secret (see test-run-secret.ts).
 */
import express from "express";
import { body, param, query } from "express-validator";
import { asyncHandler } from "./async-handler";
import { validateMiddleware } from "./helpers";
import { getRunResults, MAX_STEPS, recordResult } from "./test-result-db";
import { getTestRunSecret, hasTestRunSecret } from "./test-run-secret";
import { VERSION_PATTERN } from "./test-version-db";
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

// POST /testRuns { platform, device?, code? } - joins the newest number or opens the next one
router.post(
  "/",
  validateMiddleware([
    platformInBody,
    body("device").optional().isString().trim().isLength({ max: 100 }),
    // which code runs: the commit of the tests, and the fingerprint of the Web screens or of the App build
    body("code").optional().isObject(),
    body("code.testCommit")
      .optional()
      .matches(/^[0-9a-f]{7,40}$/),
    body("code.testDirty").optional().isBoolean({ strict: true }),
    body("code.target")
      .optional()
      .matches(/^[0-9a-f]{16}$/),
    // the version that a person wrote for the Web screens or for the App build, for example 0.101
    body("code.targetVersion").optional().isString().matches(VERSION_PATTERN),
  ]),
  asyncHandler(async (req, res) => {
    const { platform, device, code } = req.body;
    const secret = res.locals.testRunSecret;
    const started = await startRun(platform, device, secret, new Date(), code);
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

// what a result says about one piece of code: a test ("") or a tool it called ("steps.*.")
const codeOutcome = (at: "" | "steps.*.") => [
  body(`${at}name`).isString().trim().isLength({ min: 1, max: 200 }),
  body(`${at}file`).isString().trim().isLength({ min: 1, max: 200 }),
  body(`${at}status`).isIn(["passed", "failed", "skipped"]),
  body(`${at}startedAt`).isISO8601({ strict: true }),
  body(`${at}durationMs`).isInt({ min: 0, max: 2_147_483_647 }).toInt(),
  body(`${at}errorMessage`).optional({ nullable: true }).isString(),
];

// POST /testRuns/:runNo/results - one test and the tools it called. 201 stored, 200 it was stored before.
router.post(
  "/:runNo/results",
  validateMiddleware([
    runNoInPath,
    platformInBody,
    // not only the labels of the fixture rules: the App has tests of its own
    body("testCase")
      .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .isLength({ max: 50 }),
    body("attempt").optional().isInt({ min: 1, max: 100 }).toInt(),
    body("steps").optional().isArray({ max: MAX_STEPS }),
    body("steps.*.kind").isIn(["common", "api", "fixture"]),
    ...codeOutcome(""),
    ...codeOutcome("steps.*."),
  ]),
  asyncHandler(async (req, res) => {
    const answer = await recordResult(Number(req.params.runNo), req.body.platform, req.body);
    res.status(answer.stored > 0 ? 201 : 200).json(answer);
  })
);

// GET /testRuns/:runNo/results - every stored result of one number
router.get(
  "/:runNo/results",
  validateMiddleware([runNoInPath]),
  asyncHandler(async (req, res) => {
    const runNo = Number(req.params.runNo);
    res.status(200).json({ runNo, results: await getRunResults(runNo) });
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
