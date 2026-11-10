import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch errors thrown inside async route handlers.
 * This passes them to next(), so they reach the normal error handler (like sync errors did).
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
