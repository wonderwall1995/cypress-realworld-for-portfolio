/**
 * The fingerprint of source files: the same files give the same fingerprint, on every computer (line ends do not
 * count). It needs no git, and it also tells uncommitted changes apart. Only Node built-ins: the Web test runner
 * imports this file too.
 */
import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SKIPPED = new Set(["node_modules", "__tests__", ".DS_Store"]);

const filesOf = (root: string, path: string): string[] => {
  if (!statSync(join(root, path)).isDirectory()) return [path];
  return readdirSync(join(root, path))
    .filter((name) => !SKIPPED.has(name))
    .flatMap((name) => filesOf(root, `${path}/${name}`));
};

/** paths: files or folders, written with "/" and relative to root. 16 hex characters. */
export const fingerprintOf = (root: string, paths: readonly string[]): string => {
  const hash = createHash("sha256");
  for (const file of paths.flatMap((path) => filesOf(root, path)).sort()) {
    // latin1 keeps every byte, so a picture is read correctly too
    const content = readFileSync(join(root, file), "latin1").replace(/\r\n/g, "\n");
    hash.update(`${file}\0${content.length}\0`).update(content, "latin1");
  }
  return hash.digest("hex").slice(0, 16);
};
