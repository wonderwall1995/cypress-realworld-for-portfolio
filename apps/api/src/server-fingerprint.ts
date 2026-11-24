import { readFileSync } from "fs";
import { resolve } from "path";
import { fingerprintOf } from "./source-fingerprint";
import { VERSION_PATTERN } from "./test-version-db";

/** What the server is made of. Documents and tests do not count. */
const SERVER_SOURCES = [
  "apps/api/package.json",
  "apps/api/prisma",
  "apps/api/src",
  "packages/shared/src",
];

/**
 * The version of the server that a person wrote in apps/api/VERSION. Read once, like the fingerprint: after a change of
 * the file the server has to be started again. Undefined (with a warning in the answers) when it is missing or wrong.
 */
const readVersion = (): string | undefined => {
  try {
    const text = readFileSync(resolve(__dirname, "../VERSION"), "utf8").trim();
    return VERSION_PATTERN.test(text) ? text : undefined;
  } catch {
    return undefined;
  }
};
export const SERVER_VERSION = readVersion();

/** Read once, when the server starts: it is the code that runs, also when the files change later. */
export const SERVER_FINGERPRINT = fingerprintOf(resolve(__dirname, "../../.."), SERVER_SOURCES);
