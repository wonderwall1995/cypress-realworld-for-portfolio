/**
 * The demo tells here that it started, goes on, and ended. Open to everybody (a visitor is not signed in when the demo
 * starts), so it only counts demos: every value is checked, and one address can start only a few in a while.
 */
import express, { RequestHandler } from "express";
import { body, param } from "express-validator";
import { asyncHandler } from "./async-handler";
import { endDemo, getDemoState, recordDemoTest, signalDemo, startDemo } from "./demo-run-db";
import { validateMiddleware } from "./helpers";

const router = express.Router();

export const MAX_STARTS = 30;
export const STARTS_WINDOW_MS = 10 * 60_000;

// address -> when it started demos. One process only: it lives in this process's memory.
const starts = new Map<string, number[]>();
const limitStarts: RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [address, times] of starts) {
    const recent = times.filter((time) => now - time < STARTS_WINDOW_MS);
    if (recent.length > 0) starts.set(address, recent);
    else starts.delete(address);
  }
  const address = req.ip ?? "unknown";
  const mine = starts.get(address) ?? [];
  if (mine.length >= MAX_STARTS) return res.status(429).json({ error: "too many demos" });
  starts.set(address, [...mine, now]);
  next();
};

const idInPath = param("id").isInt({ min: 1, max: 2_147_483_647 }).toInt();
const token = body("token")
  .isString()
  .matches(/^[0-9a-f]{48}$/);

const testAt = (at: "" | "test.") => [
  body(`${at}testCase`)
    .isString()
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .isLength({ max: 50 }),
  body(`${at}file`).isString().trim().isLength({ min: 1, max: 100 }),
  body(`${at}status`).isIn(["passed", "failed", "skipped"]),
  body(`${at}startedAt`).isISO8601({ strict: true }),
  body(`${at}durationMs`).isInt({ min: 0, max: 2_147_483_647 }).toInt(),
  body(`${at}errorMessage`).optional({ nullable: true }).isString(),
];

// GET /demoRuns/current - is a demo going on now?
router.get(
  "/current",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await getDemoState());
  })
);

// POST /demoRuns { mode } - a demo starts. The token of the answer is needed for everything after it.
router.post(
  "/",
  limitStarts,
  validateMiddleware([body("mode").isIn(["all", "partial"])]),
  asyncHandler(async (req, res) => {
    res.status(201).json(await startDemo(req.body.mode));
  })
);

// POST /demoRuns/:id/signal { token, status } - it goes on (running or paused)
router.post(
  "/:id/signal",
  validateMiddleware([idInPath, token, body("status").isIn(["running", "paused"])]),
  asyncHandler(async (req, res) => {
    res.json(await signalDemo(Number(req.params.id), req.body.token, req.body.status));
  })
);

// POST /demoRuns/:id/tests { token, ...test } - one test is over
router.post(
  "/:id/tests",
  validateMiddleware([idInPath, token, ...testAt("")]),
  asyncHandler(async (req, res) => {
    await recordDemoTest(Number(req.params.id), req.body.token, req.body);
    res.sendStatus(204);
  })
);

// POST /demoRuns/:id/end { token, status, reason?, test? } - it is over
const testIsThere = (_value: unknown, { req }: any) => req.body?.test !== undefined;
router.post(
  "/:id/end",
  validateMiddleware([
    idInPath,
    token,
    body("status").isIn(["finished", "failed", "stopped"]),
    body("reason").optional().isIn(["button", "closed"]), // "lost" is only the server's own word
    body("test").optional().isObject(),
    ...testAt("test.").map((check) => check.if(testIsThere as any)),
  ]),
  asyncHandler(async (req, res) => {
    const { status, reason, test } = req.body;
    res.json(await endDemo(Number(req.params.id), req.body.token, { status, reason, test }));
  })
);

export default router;
