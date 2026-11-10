import { randomBytes } from "crypto";

const MIN_PRODUCTION_LENGTH = 32;

/**
 * The secret that signs the session cookie. express-session cannot run without one.
 * It is read from SESSION_SECRET, so no secret value lives in the code.
 *
 *   set                  used as is
 *   not set, production  the server refuses to start
 *   not set, other modes a random secret is made on every start (everyone is logged out on restart,
 *                        which already happens because sessions live in memory)
 */
export const getSessionSecret = (env: NodeJS.ProcessEnv = process.env): string => {
  const secret = env.SESSION_SECRET?.trim();

  if (env.NODE_ENV === "production") {
    if (!secret || secret.length < MIN_PRODUCTION_LENGTH) {
      throw new Error(
        `SESSION_SECRET must be set to a random value of at least ${MIN_PRODUCTION_LENGTH} characters in production.`
      );
    }
    return secret;
  }

  if (secret) {
    return secret;
  }

  console.warn("[session] SESSION_SECRET is not set. A random secret is used for this run.");
  return randomBytes(32).toString("hex");
};
