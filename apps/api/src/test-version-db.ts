/**
 * Versions of what a numbered run works with: the server, the Web screens and the App build. A person writes them
 * (apps/api/VERSION, apps/web/VERSION, the App's own file). The fingerprint of the source is kept with the version,
 * so that a version that was not raised, or was raised for nothing, is noticed. Nothing is refused: it is a warning.
 */
import { VersionPart } from "@prisma/client";
import { DbClient } from "./prisma";

/** major.minor, for example 0.100 */
export const VERSION_PATTERN = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,5})$/;

export interface VersionWarning {
  part: VersionPart;
  code: "code_changed" | "version_changed" | "version_missing" | "fingerprint_missing";
  /** The version that was written or sent */
  sent: string | null;
  /** The version that is stored for this run */
  used: string | null;
  message: string;
}

const MESSAGES: Record<VersionWarning["code"], string> = {
  code_changed: "the code changed but the version was not raised",
  version_changed: "this code already has a version: the older one is used",
  version_missing: "no version was given",
  fingerprint_missing: "no fingerprint was given: the code cannot be checked",
};

export interface UsedVersion {
  version: string | null;
  warning?: VersionWarning;
}

/** Only inside changeRuns (test-run-db.ts): its lock keeps two runs from making the same version. */
export const useVersion = async (
  tx: DbClient,
  part: VersionPart,
  sent: string | undefined,
  fingerprint: string | undefined,
  now: Date
): Promise<UsedVersion> => {
  const answer = (used: string | null, code?: VersionWarning["code"]): UsedVersion => ({
    version: used,
    ...(code && { warning: { part, code, sent: sent ?? null, used, message: MESSAGES[code] } }),
  });

  if (!sent && !fingerprint) return answer(null);
  if (!sent) {
    const known = await tx.testVersion.findFirst({
      where: { part, fingerprint },
      orderBy: [{ major: "desc" }, { minor: "desc" }],
    });
    return answer(known?.version ?? null, "version_missing");
  }
  if (!fingerprint) return answer(sent, "fingerprint_missing");

  const [major, minor] = sent.split(".").map(Number);
  // the same code has one version in one major: the older one stays
  const sameCode = await tx.testVersion.findUnique({
    where: { part_major_fingerprint: { part, major, fingerprint } },
  });
  if (sameCode) {
    return sameCode.version === sent ? answer(sent) : answer(sameCode.version, "version_changed");
  }
  if (await tx.testVersion.findUnique({ where: { part_version: { part, version: sent } } })) {
    return answer(sent, "code_changed"); // the first fingerprint of the version stays
  }
  await tx.testVersion.create({
    data: { part, version: sent, major, minor, fingerprint, firstSeenAt: now },
  });
  return answer(sent);
};
