/**
 * The password that is typed again before money leaves an account. Someone who holds a signed-in device must not be
 * able to try every password: after MAX_WRONG wrong ones, the member has to wait until WINDOW_MS has passed since the
 * first of them. Signing in is another matter (limited by Nginx, see docs/aws-guide.md).
 * One process only: the counts live in this process's memory.
 */
import { passwordMatches } from "./account-money";
import { HttpError } from "./http-error";

export const MAX_WRONG = 10;
export const WINDOW_MS = 10 * 60_000;

// userId -> the wrong tries since `since`
const tries = new Map<string, { count: number; since: number }>();

/** Throws 403 when the password is wrong, and 429 when there were too many wrong ones (also for the right one). */
export const checkPasswordAgain = async (
  userId: string,
  password: unknown,
  now: number = Date.now()
): Promise<void> => {
  for (const [id, entry] of tries) if (now - entry.since >= WINDOW_MS) tries.delete(id);

  const entry = tries.get(userId) ?? { count: 0, since: now };
  if (entry.count >= MAX_WRONG) {
    throw new HttpError(429, "too many wrong passwords, try again later");
  }
  // counted before the check, so many requests at the same moment cannot pass together
  entry.count += 1;
  tries.set(userId, entry);

  if (!(await passwordMatches(userId, password))) {
    throw new HttpError(403, "the password is not correct");
  }
  tries.delete(userId);
};
