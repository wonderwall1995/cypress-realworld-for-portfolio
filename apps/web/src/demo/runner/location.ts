/**
 * Finds which line of a test file is running, without changing the test code.
 *
 * The runner reads the call stack when a test calls page.click(...) and so on. The browser runs the
 * JavaScript that Vite made from the .ts file, so the line in the stack belongs to that JavaScript.
 * The source map that Vite adds to the module turns it back into the line of the .ts file.
 */
export interface StepLocation {
  /** path from the repository root, for example tests/e2e/common/signup.ts */
  path: string;
  /** line number in the original .ts file (starts at 1) */
  line: number;
}

const FRAME = /(https?:\/\/[^\s()]+?):(\d+):(\d+)/;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// one entry per generated line: [generated column, original line] pairs
type LineTable = number[][][];
const tables = new Map<string, Promise<LineTable | null>>();

const decodeVlq = (segment: string): number[] => {
  const values: number[] = [];
  let shift = 0;
  let value = 0;
  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      values.push(value & 1 ? -(value >> 1) : value >> 1);
      value = 0;
      shift = 0;
    }
  }
  return values;
};

const parseMappings = (mappings: string): LineTable => {
  const lines: LineTable = [];
  let sourceLine = 0;
  for (const lineText of mappings.split(";")) {
    const segments: number[][] = [];
    let column = 0;
    if (lineText) {
      for (const segment of lineText.split(",")) {
        const fields = decodeVlq(segment);
        column += fields[0];
        if (fields.length >= 4) {
          sourceLine += fields[2];
          segments.push([column, sourceLine]);
        }
      }
    }
    lines.push(segments);
  }
  return lines;
};

const loadTable = async (url: string): Promise<LineTable | null> => {
  const text = await (await fetch(url)).text();
  const found = /\/\/# sourceMappingURL=data:application\/json;(?:charset=[^;]+;)?base64,([A-Za-z0-9+/=]+)/.exec(
    text
  );
  if (!found) return null;
  const json = new TextDecoder().decode(Uint8Array.from(atob(found[1]), (c) => c.charCodeAt(0)));
  return parseMappings(JSON.parse(json).mappings);
};

// the URL of a module outside the web root contains the repository path: .../tests/e2e/xxx.ts?t=123
const repoPath = (url: string): string | null => {
  const clean = decodeURIComponent(url).split("?")[0].split("#")[0];
  const at = clean.lastIndexOf("/tests/e2e/");
  return at < 0 ? null : clean.slice(at + 1);
};

const toOriginal = async (url: string, line: number, column: number): Promise<StepLocation | null> => {
  const path = repoPath(url);
  if (!path) return null;
  if (!tables.has(url)) tables.set(url, loadTable(url).catch(() => null));
  const table = await tables.get(url)!;
  const segments = table?.[line - 1];
  if (!segments || segments.length === 0) return null;
  let best = segments[0];
  for (const segment of segments) if (segment[0] <= column - 1) best = segment;
  return { path, line: best[1] + 1 };
};

/**
 * Call this at the start of a runner function (before any await). It reads the stack now and
 * returns the first frame that is not inside the runner: the line of the test code that called it.
 */
export function captureCaller(): Promise<StepLocation | null> {
  const stack = new Error().stack ?? "";
  for (const raw of stack.split("\n").slice(1)) {
    const match = FRAME.exec(raw);
    if (!match) continue;
    const [, url, line, column] = match;
    if (url.includes("/demo/runner/")) continue;
    return toOriginal(url, Number(line), Number(column));
  }
  return Promise.resolve(null);
}
