import { resolve } from "path";
import { fingerprintOf } from "./source-fingerprint";

/** What the server is made of. Documents and tests do not count. */
const SERVER_SOURCES = [
  "apps/api/package.json",
  "apps/api/prisma",
  "apps/api/src",
  "packages/shared/src",
];

/** Read once, when the server starts: it is the code that runs, also when the files change later. */
export const SERVER_FINGERPRINT = fingerprintOf(resolve(__dirname, "../../.."), SERVER_SOURCES);
