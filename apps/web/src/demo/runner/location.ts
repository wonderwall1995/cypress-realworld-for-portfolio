/**
 * Finds which line of a test file is running, without changing the test code.
 *
 * The runner reads the call stack when a test calls page.click(...) and so on. The browser runs the
 * JavaScript that Vite made from the .ts file, so the line in the stack belongs to that JavaScript.
 * The source map that Vite adds to the module (inside the file, or as a .map file next to it in a build)
 * turns it back into the line of the .ts file.
 */
export interface StepLocation {
  /** path from the repository root, for example tests/e2e/common/signup.ts */
  path: string;
  /** line number in the original .ts file (starts at 1) */
  line: number;
}

const FRAME = /(https?:\/\/[^\s()]+?):(\d+):(\d+)/;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const INLINE_MAP = /\/\/# sourceMappingURL=data:application\/json;(?:charset=[^;]+;)?base64,([A-Za-z0-9+/=]+)/;
const EXTERNAL_MAP = /\/\/# sourceMappingURL=(\S+?)\s*$/;

// one entry per generated line: [generated column, source index, original line] triples
type LineTable = number[][][];
interface SourceMap {
  table: LineTable;
  /** the original files that the generated code came from (a built chunk holds many files) */
  sources: string[];
}
const maps = new Map<string, Promise<SourceMap | null>>();

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
  let sourceIndex = 0;
  let sourceLine = 0;
  for (const lineText of mappings.split(";")) {
    const segments: number[][] = [];
    let column = 0;
    if (lineText) {
      for (const segment of lineText.split(",")) {
        const fields = decodeVlq(segment);
        column += fields[0];
        if (fields.length >= 4) {
          sourceIndex += fields[1];
          sourceLine += fields[2];
          segments.push([column, sourceIndex, sourceLine]);
        }
      }
    }
    lines.push(segments);
  }
  return lines;
};

// The source map is inside the file (the dev server) or next to it as a .map file (a build).
const loadMap = async (url: string): Promise<SourceMap | null> => {
  const text = await (await fetch(url)).text();
  let json: { mappings: string; sources?: string[] };
  const inline = INLINE_MAP.exec(text);
  if (inline) {
    json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(inline[1]), (c) => c.charCodeAt(0))));
  } else {
    const external = EXTERNAL_MAP.exec(text);
    if (!external) return null;
    json = await (await fetch(new URL(external[1], url).href)).json();
  }
  return { table: parseMappings(json.mappings), sources: json.sources ?? [] };
};

// a path of the repository that holds tests: .../tests/e2e/xxx.ts (the address of a dev module, or a source of a map)
const repoPath = (text: string): string | null => {
  const clean = decodeURIComponent(text).split("?")[0].split("#")[0];
  const at = clean.lastIndexOf("/tests/e2e/");
  if (at >= 0) return clean.slice(at + 1);
  return clean.startsWith("tests/e2e/") ? clean : null;
};

const toOriginal = async (url: string, line: number, column: number): Promise<StepLocation | null> => {
  const key = url.split("?")[0];
  if (!maps.has(key)) maps.set(key, loadMap(key).catch(() => null));
  const map = await maps.get(key)!;
  const segments = map?.table[line - 1];
  if (!map || !segments || segments.length === 0) return null;
  let best = segments[0];
  for (const segment of segments) if (segment[0] <= column - 1) best = segment;
  // the dev server: one module per file, and the address has the path. A build: the source of the map has it
  const path = repoPath(url) ?? repoPath(map.sources[best[1]] ?? "");
  if (!path) return null;
  return { path, line: best[2] + 1 };
};

/**
 * Call this at the start of a runner function (before any await). It reads the stack now and
 * returns the first frame that is not inside the runner: the line of the test code that called it.
 */
export function captureCaller(): Promise<StepLocation | null> {
  const stack = new Error().stack ?? "";
  const frames: { url: string; line: number; column: number }[] = [];
  for (const raw of stack.split("\n").slice(1)) {
    const match = FRAME.exec(raw);
    if (!match) continue;
    const [, url, line, column] = match;
    if (url.includes("/demo/runner/")) continue;
    frames.push({ url, line: Number(line), column: Number(column) });
  }
  // a frame of the runner or of the app (in a build, they are in other chunks) maps to a file outside
  // tests/e2e: look at the next frame
  return (async () => {
    for (const frame of frames) {
      const found = await toOriginal(frame.url, frame.line, frame.column);
      if (found) return found;
    }
    return null;
  })();
}
