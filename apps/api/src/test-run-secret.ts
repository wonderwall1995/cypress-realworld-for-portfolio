/**
 * The secret of the test-run API. Only the test runners (Playwright, Wdio) and the server know it.
 * It is read from TEST_RUN_SECRET, so no secret value lives in the code. Without it (or with a short one)
 * the protected routes do not exist (404).
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";

const MIN_LENGTH = 32;

/** The secret, or undefined when the test-run API is closed on this server. */
export const getTestRunSecret = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
  const secret = env.TEST_RUN_SECRET?.trim();
  return secret && secret.length >= MIN_LENGTH ? secret : undefined;
};

const digest = (text: string) => createHash("sha256").update(text).digest();

/** True when the Authorization header carries the secret. The comparison takes the same time for every wrong value. */
export const hasTestRunSecret = (header: string | undefined, secret: string): boolean =>
  timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));

/**
 * The password of one fixture person. It is NOT stored: the demo shows every table of the database, and the
 * people of a run stay for the regression check. The same secret and person always give the same password.
 */
export const fixturePassword = (
  secret: string,
  runNo: number,
  testCase: string,
  person: string
): string =>
  createHmac("sha256", secret).update(`${runNo}/${testCase}/${person}`).digest("hex").slice(0, 24);
