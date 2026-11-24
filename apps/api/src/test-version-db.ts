/**
 * Versions of what a numbered run works with: the server, the Web screens and the App build. Each has its own line:
 * 0.100, 0.101, 0.102... A fingerprint that was not seen before gets the next version, a known one keeps its own.
 */
import { VersionPart } from "@prisma/client";
import { DbClient } from "./prisma";

/** Raised only when the User asks for it. The line of the new major starts at .100 again. */
export const VERSION_MAJOR = 0;
const FIRST_MINOR = 100;

/** Only inside changeRuns (test-run-db.ts): its lock keeps two runs from making the same version. */
export const versionOf = async (
  tx: DbClient,
  part: VersionPart,
  fingerprint: string,
  now: Date
): Promise<string> => {
  const major = VERSION_MAJOR;
  const known = await tx.testVersion.findUnique({
    where: { part_major_fingerprint: { part, major, fingerprint } },
  });
  if (known) return known.version;

  const newest = await tx.testVersion.findFirst({
    where: { part, major },
    orderBy: { minor: "desc" },
  });
  const minor = newest ? newest.minor + 1 : FIRST_MINOR;
  const version = `${major}.${minor}`;
  await tx.testVersion.create({
    data: { part, version, major, minor, fingerprint, firstSeenAt: now },
  });
  return version;
};
