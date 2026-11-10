/**
 * Strips fields that must never leave the server from a user object.
 * Apply it to every API response that carries a user (the database layer keeps the field
 * because the login check needs it).
 */
export const omitPassword = <T extends { password?: unknown }>(
  user: T | undefined
): Omit<T, "password"> | undefined => {
  if (!user) {
    return undefined;
  }
  const { password: _password, ...safeUser } = user;
  return safeUser;
};
