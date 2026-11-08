/**
 * data-testid indexer (Babel AST) for src/**.tsx
 *
 *   pnpm testid:list         rebuild testid-listup.md
 *   pnpm testid:check        fail (exit 1) if the list is stale or interactive elements lack an id
 *   pnpm testid:add          dry-run: print the ids that would be added
 *   pnpm testid:add:write    insert the proposed ids into the source files
 *
 * Design rules (why this is not "tag everything"):
 *   1. Only interactive elements get an id: buttons, fields, links, anything with a
 *      handler, and the root element of a .map() list item.
 *      Layout elements (div, svg, Grid ...) are never indexed.
 *   2. Existing ids are never renamed, replaced or removed (tests depend on them).
 *   3. Names come from meaning (name / text / aria-label / route / handler), never from
 *      a position number, so inserting an element does not shift other ids.
 *   4. List items use the item's own id (`${item.id}`), never the array index.
 *      If no stable key can be found, the element is reported for manual naming.
 *   5. Edits are plain text insertions at the tag name: the rest of the file is untouched
 *      (no reformatting, same line endings, minimal diff).
 *   6. Skip one element with a comment: {/* testid-ignore *\/} or /* testid-ignore *\/ before it.
 */
import fs from "fs";
import path from "path";
import prettier from "prettier";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUTPUT = path.join(ROOT, "testid-listup.md");

const ATTR = "data-testid";
const PROP = "dataTestId";
const IGNORE_COMMENT = "testid-ignore";

const args = new Set(process.argv.slice(2));
const MODE_CHECK = args.has("--check");
const MODE_ADD = args.has("--add");
const WRITE = args.has("--write");

// ---------------------------------------------------------------- rules

/** Elements that are interactive by nature (only when they also behave, see isTarget). */
const FIELD_TAGS = new Set([
  "input",
  "textarea",
  "select",
  "TextField",
  "Checkbox",
  "Radio",
  "Switch",
  "Select",
  "Autocomplete",
]);
const ACTION_TAGS = new Set(["button", "Button", "IconButton", "Fab", "Tab", "MenuItem"]);
const LINK_TAGS = new Set(["a", "Link"]);
const HANDLERS = ["onClick", "onChange", "onSubmit", "onBlur", "onKeyDown", "onInput"];
const FEATURE_ATTRS = ["type", "name", "to", "href", "role", "component"];

/** Libraries whose components are logic/routing wrappers, not UI controls. */
const NON_UI_SOURCES = [/^formik$/, /^react-router/, /^xstate$/, /^@xstate\//, /^history$/];
const NON_UI_NAMES = /^(Formik|StyledFormik|Switch|Route|Router|BrowserRouter|Redirect|Provider)$/;

/** Components that forward an id prop to a DOM element: (component) -> prop name */
const ID_FORWARDING_PROPS = new Set([PROP]);

interface Entry {
  file: string;
  line: number;
  id: string;
  dynamic: boolean;
  variables: string[];
  component: string;
  element: string;
  carrier: "attribute" | "inputProps" | "prop";
  features: string[];
}

interface Candidate {
  file: string;
  line: number;
  component: string;
  element: string;
  features: string[];
  /** proposed id (static text or template with ${expr}); null when a human must choose */
  proposal: string | null;
  dynamic: boolean;
  reason: string;
  insertAt: number;
  /** set when an empty data-testid="" placeholder exists: its value is replaced instead of inserting */
  blank?: { start: number; end: number };
  /** repo-relative file of the local component this element renders (if any) */
  delegate?: string;
}

// ---------------------------------------------------------------- helpers

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.tsx$/.test(e.name) && !/\.(test|spec|stories|cy)\.tsx$/.test(e.name) ? [p] : [];
  });
}

function elementName(n: t.JSXOpeningElement["name"]): string {
  if (t.isJSXIdentifier(n)) return n.name;
  if (t.isJSXMemberExpression(n))
    return `${elementName(n.object as t.JSXOpeningElement["name"])}.${n.property.name}`;
  return `${n.namespace.name}:${n.name.name}`;
}

function attrName(a: t.JSXAttribute): string {
  return t.isJSXIdentifier(a.name) ? a.name.name : `${a.name.namespace.name}:${a.name.name.name}`;
}

function exprText(e: t.Node): string {
  if (t.isIdentifier(e)) return e.name;
  if (t.isMemberExpression(e) || t.isOptionalMemberExpression(e)) {
    const prop = t.isIdentifier(e.property) ? e.property.name : "?";
    return `${exprText(e.object)}.${prop}`;
  }
  return "...";
}

function readId(node: t.Node | null | undefined): { id: string; variables: string[] } | null {
  if (!node) return null;
  if (t.isJSXExpressionContainer(node)) return readId(node.expression);
  if (t.isStringLiteral(node)) return { id: node.value, variables: [] };
  if (t.isTemplateLiteral(node)) {
    const variables: string[] = [];
    let id = "";
    node.quasis.forEach((q, i) => {
      id += q.value.cooked ?? "";
      const e = node.expressions[i];
      if (e) {
        const code = exprText(e);
        variables.push(code);
        id += "${" + code + "}";
      }
    });
    return { id, variables };
  }
  if (t.isIdentifier(node)) return { id: "${" + node.name + "}", variables: [node.name] };
  return null;
}

function componentOf(p: NodePath): string {
  let cur: NodePath | null = p;
  while (cur) {
    const n = cur.node;
    if (t.isFunctionDeclaration(n) && n.id) return n.id.name;
    if (t.isVariableDeclarator(n) && t.isIdentifier(n.id)) {
      const isFn = t.isArrowFunctionExpression(n.init) || t.isFunctionExpression(n.init);
      if (isFn || /^[A-Z]/.test(n.id.name)) return n.id.name;
    }
    cur = cur.parentPath;
  }
  return "module";
}

const kebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

function attrsOf(opening: t.JSXOpeningElement): t.JSXAttribute[] {
  return opening.attributes.filter((a): a is t.JSXAttribute => t.isJSXAttribute(a));
}

function stringAttr(attrs: t.JSXAttribute[], key: string): string | null {
  const a = attrs.find((x) => attrName(x) === key);
  const r = a ? readId(a.value) : null;
  return r && r.variables.length === 0 ? r.id : null;
}

function directText(parent: t.JSXElement | null): string {
  if (!parent) return "";
  return parent.children
    .map((c) => (t.isJSXText(c) ? c.value.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function featuresOf(opening: t.JSXOpeningElement, parent: t.JSXElement | null): string[] {
  const out: string[] = [];
  const attrs = attrsOf(opening);
  for (const h of HANDLERS) if (attrs.some((a) => attrName(a) === h)) out.push(h);
  for (const key of FEATURE_ATTRS) {
    const a = attrs.find((x) => attrName(x) === key);
    if (!a) continue;
    const v = readId(a.value);
    out.push(`${key}=${v ? v.id : "..."}`);
  }
  if (attrs.some((a) => attrName(a) === "button")) out.push("button");
  const text = directText(parent);
  if (text) out.push(`text="${text.slice(0, 40)}"`);
  return out;
}

function hasIgnoreComment(p: NodePath<t.JSXOpeningElement>): boolean {
  const el = p.parentPath?.node;
  const comments = [...(el?.leadingComments ?? []), ...(p.node.leadingComments ?? [])];
  // {/* testid-ignore */} lives in a JSXExpressionContainer sibling right before the element
  const container = p.parentPath?.parentPath;
  const siblings = container && t.isJSXElement(container.node) ? container.node.children : [];
  const idx = siblings.indexOf(p.parent as t.JSXElement);
  for (let i = idx - 1; i >= 0; i--) {
    const s = siblings[i];
    if (t.isJSXText(s) && s.value.trim() === "") continue;
    if (t.isJSXExpressionContainer(s) && t.isJSXEmptyExpression(s.expression)) {
      comments.push(...(s.expression.innerComments ?? []));
    }
    break;
  }
  return comments.some((c) => c.value.includes(IGNORE_COMMENT));
}

// ---------------------------------------------------------------- target + naming

type Origin = "native" | "library" | "local";

/** native (<button>), library (@mui/*), or local (defined in this repo: may not forward props) */
function resolveLocalImport(fromFile: string, source: string): string | null {
  const base = path.resolve(path.dirname(fromFile), source);
  for (const ext of [".tsx", ".ts", "/index.tsx"]) {
    if (fs.existsSync(base + ext)) return path.relative(ROOT, base + ext).replace(/\\/g, "/");
  }
  return null;
}

function originOf(element: string, imports: Map<string, string>): Origin | "skip" {
  const root = element.split(".")[0];
  if (/^[a-z]/.test(root)) return "native";
  if (NON_UI_NAMES.test(root)) return "skip";
  const source = imports.get(root);
  if (!source) return "local"; // declared in the same file (styled(), local component)
  if (NON_UI_SOURCES.some((r) => r.test(source))) return "skip";
  return source.startsWith(".") || source.startsWith("src/") ? "local" : "library";
}

function isTarget(element: string, attrs: t.JSXAttribute[]): boolean {
  const names = attrs.map(attrName);
  const behaves = names.some((n) => HANDLERS.includes(n));
  if (FIELD_TAGS.has(element)) return true;
  if (ACTION_TAGS.has(element)) return true;
  if (LINK_TAGS.has(element)) return names.includes("to") || names.includes("href");
  if (element === "form") return names.includes("onSubmit");
  return behaves; // Chip, ListItem, Icon ... only when they carry a handler
}

function kindOf(element: string, attrs: t.JSXAttribute[]): string {
  if (FIELD_TAGS.has(element)) {
    if (element === "Checkbox") return "checkbox";
    if (element === "Switch") return "switch";
    if (element === "Radio") return "radio";
    if (element === "Select" || element === "select") return "select";
    return "input";
  }
  if (element === "form") return "form";
  if (LINK_TAGS.has(element)) return "link";
  if (element === "Tab") return "tab";
  if (element === "MenuItem") return "menu-item";
  if (ACTION_TAGS.has(element)) return "button";
  return attrs.some((a) => attrName(a) === "onClick") ? "button" : "control";
}

function handlerPurpose(attrs: t.JSXAttribute[]): string | null {
  for (const key of ["onClick", "onSubmit", "onChange"]) {
    const a = attrs.find((x) => attrName(x) === key);
    if (!a || !t.isJSXExpressionContainer(a.value)) continue;
    let e: t.Node = a.value.expression;
    if (t.isArrowFunctionExpression(e) && t.isCallExpression(e.body)) e = e.body.callee;
    else if (t.isArrowFunctionExpression(e) && t.isBlockStatement(e.body)) continue;
    const name = t.isIdentifier(e)
      ? e.name
      : t.isMemberExpression(e) && t.isIdentifier(e.property)
        ? e.property.name
        : "";
    const cleaned = kebab(name.replace(/^(on|handle)/, ""));
    if (cleaned && cleaned.length > 2) return cleaned;
  }
  return null;
}

/** meaning of an element: name > aria-label > text > label > placeholder > route > handler */
function purposeOf(attrs: t.JSXAttribute[], parent: t.JSXElement | null): string | null {
  const candidates = [
    stringAttr(attrs, "name"),
    stringAttr(attrs, "aria-label"),
    directText(parent),
    stringAttr(attrs, "label"),
    stringAttr(attrs, "placeholder"),
    (() => {
      const to = stringAttr(attrs, "to") ?? stringAttr(attrs, "href");
      return to ? to.replace(/^https?:\/\/[^/]+/, "").replace(/\/:?\w*$/, "") || "home" : null;
    })(),
    handlerPurpose(attrs),
  ];
  for (const c of candidates) {
    const k = c ? kebab(c) : "";
    if (k) return k.split("-").slice(0, 4).join("-");
  }
  return null;
}

/** root JSX element returned by a `.map(cb)` callback -> stable key expression, if any */
function mapItemKey(p: NodePath<t.JSXOpeningElement>): { key: string | null; isMapRoot: boolean } {
  const elPath = p.parentPath as NodePath<t.JSXElement>;
  const up = elPath.parentPath;
  if (!up) return { key: null, isMapRoot: false };
  const fnPath = up.isArrowFunctionExpression()
    ? up
    : up.isReturnStatement()
      ? up.findParent((x) => x.isFunction())
      : null;
  if (!fnPath || !fnPath.isFunction()) return { key: null, isMapRoot: false };
  const call = fnPath.parentPath;
  const isMap =
    call &&
    (call.isCallExpression() || call.isOptionalCallExpression()) &&
    (call.node.callee as t.MemberExpression).property &&
    t.isIdentifier((call.node.callee as t.MemberExpression).property, { name: "map" }) &&
    call.node.arguments[0] === fnPath.node;
  if (!isMap) return { key: null, isMapRoot: false };
  const first = (fnPath.node as t.ArrowFunctionExpression).params[0];
  if (t.isIdentifier(first)) return { key: `${first.name}.id`, isMapRoot: true };
  if (t.isObjectPattern(first)) {
    const hasId = first.properties.some(
      (x) => t.isObjectProperty(x) && t.isIdentifier(x.key, { name: "id" })
    );
    if (hasId) return { key: "id", isMapRoot: true };
  }
  return { key: null, isMapRoot: true };
}

// ---------------------------------------------------------------- scan

const entries: Entry[] = [];
const candidates: Candidate[] = [];

function scan(): void {
  for (const file of walk(SRC).sort()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const ast = parse(fs.readFileSync(file, "utf8"), {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });

    const imports = new Map<string, string>();
    traverse(ast, {
      ImportDeclaration(p) {
        p.node.specifiers.forEach((sp) => imports.set(sp.local.name, p.node.source.value));
      },
      JSXOpeningElement(p) {
        const opening = p.node;
        const element = elementName(opening.name);
        const attrs = attrsOf(opening);
        const parentEl = t.isJSXElement(p.parent) ? p.parent : null;
        const line = opening.loc?.start.line ?? 0;
        const component = componentOf(p);
        let indexed = false;
        let blank: { start: number; end: number } | undefined;

        const push = (r: { id: string; variables: string[] }, carrier: Entry["carrier"]) => {
          indexed = true;
          entries.push({
            file: rel,
            line,
            id: r.id,
            dynamic: r.variables.length > 0,
            variables: r.variables,
            component,
            element,
            carrier,
            features: featuresOf(opening, parentEl),
          });
        };

        for (const a of attrs) {
          const name = attrName(a);
          if (name === ATTR || ID_FORWARDING_PROPS.has(name)) {
            const r = readId(a.value);
            if (
              name === ATTR &&
              r &&
              r.id.trim() === "" &&
              a.value?.start != null &&
              a.value.end != null
            ) {
              blank = { start: a.value.start, end: a.value.end }; // unfilled placeholder
            } else if (r) {
              push(r, name === ATTR ? "attribute" : "prop");
            }
          }
          if (
            name === "inputProps" &&
            t.isJSXExpressionContainer(a.value) &&
            t.isObjectExpression(a.value.expression)
          ) {
            for (const prop of a.value.expression.properties) {
              if (!t.isObjectProperty(prop)) continue;
              const key = t.isStringLiteral(prop.key)
                ? prop.key.value
                : t.isIdentifier(prop.key)
                  ? prop.key.name
                  : "";
              if (key !== ATTR) continue;
              const r = readId(prop.value);
              if (r) push(r, "inputProps");
            }
          }
        }
        if (indexed || hasIgnoreComment(p)) return;

        // spreading props may already carry an id (<Foo {...props} />): leave it alone
        if (!blank && opening.attributes.some((a) => t.isJSXSpreadAttribute(a))) return;

        const origin = originOf(element, imports);
        if (origin === "skip") return;
        const { key, isMapRoot } = mapItemKey(p);
        if (!isMapRoot && !blank && !isTarget(element, attrs)) return;

        const area = kebab(component);
        const insertAt = opening.typeParameters?.end ?? opening.name.end ?? 0;
        const features = featuresOf(opening, parentEl);
        const base: Omit<Candidate, "proposal" | "dynamic" | "reason"> = {
          file: rel,
          line,
          component,
          element,
          features,
          insertAt,
          blank,
        };

        // a local component only shows the id if it forwards props to a DOM element
        if (origin === "local") {
          const how = key ? "key=" + key : "";
          const source = imports.get(element.split(".")[0]);
          candidates.push({
            ...base,
            delegate: source?.startsWith(".")
              ? (resolveLocalImport(file, source) ?? undefined)
              : undefined,
            proposal: null,
            dynamic: false,
            reason:
              `직접 만든 컴포넌트: 내부 요소에 id를 달거나 dataTestId prop으로 전달하세요 ${how}`.trim(),
          });
          return;
        }

        if (isMapRoot) {
          if (key) {
            candidates.push({
              ...base,
              proposal: `${area}-item-\${${key}}`,
              dynamic: true,
              reason: "목록 항목 (항목 id 사용)",
            });
          } else {
            candidates.push({
              ...base,
              proposal: null,
              dynamic: false,
              reason: "목록 항목인데 안정적인 id를 찾지 못함 (직접 지정)",
            });
          }
          return;
        }

        const kind = kindOf(element, attrs);
        if (kind === "control") {
          candidates.push({
            ...base,
            proposal: null,
            dynamic: false,
            reason: "핸들러만 있고 역할이 불분명함 (직접 지정)",
          });
          return;
        }
        const purpose = purposeOf(attrs, parentEl);
        if (!purpose) {
          candidates.push({
            ...base,
            proposal: null,
            dynamic: false,
            reason: "의미를 알 수 있는 이름/글자/경로가 없음 (직접 지정)",
          });
          return;
        }
        candidates.push({
          ...base,
          proposal: `${area}-${purpose}-${kind}`,
          dynamic: false,
          reason: "상호작용 요소",
        });
      },
    });
  }
}

// ---------------------------------------------------------------- apply

/** a local component that already carries ids inside its own file is considered covered */
function dropDelegatedCandidates(): void {
  const filesWithIds = new Set(entries.map((e) => e.file));
  for (let i = candidates.length - 1; i >= 0; i--) {
    const d = candidates[i].delegate;
    if (d && filesWithIds.has(d)) candidates.splice(i, 1);
  }
}

/** make proposals unique against existing ids and each other; flag changed ones for review */
function resolveCollisions(): void {
  const used = new Set(entries.filter((e) => !e.dynamic).map((e) => e.id));
  for (const c of candidates) {
    if (!c.proposal || c.dynamic) continue;
    let id = c.proposal;
    let n = 1;
    while (used.has(id)) id = `${c.proposal}-${++n}`;
    if (id !== c.proposal) c.reason += " (같은 이름이 있어 번호를 붙임, 이름 확인 필요)";
    c.proposal = id;
    used.add(id);
  }
}

async function applyProposals(): Promise<void> {
  const byFile = new Map<string, Candidate[]>();
  candidates
    .filter((c) => c.proposal)
    .forEach((c) => byFile.set(c.file, [...(byFile.get(c.file) ?? []), c]));

  for (const [rel, list] of byFile) {
    const abs = path.join(ROOT, rel);
    let code = fs.readFileSync(abs, "utf8");
    const wasClean = await prettier.check(code, {
      ...(await prettier.resolveConfig(abs)),
      filepath: abs,
    });
    // insert from the bottom up so earlier offsets stay valid
    const pos = (c: Candidate) => c.blank?.start ?? c.insertAt;
    for (const c of [...list].sort((a, b) => pos(b) - pos(a))) {
      if (c.blank) {
        const value = c.dynamic ? `{\`${c.proposal}\`}` : `"${c.proposal}"`;
        code = code.slice(0, c.blank.start) + value + code.slice(c.blank.end);
      } else {
        const attr = c.dynamic ? ` ${ATTR}={\`${c.proposal}\`}` : ` ${ATTR}="${c.proposal}"`;
        code = code.slice(0, c.insertAt) + attr + code.slice(c.insertAt);
      }
    }
    // only re-run prettier when the file was prettier-clean before, so we never reformat unrelated code
    if (wasClean)
      code = await prettier.format(code, { ...(await prettier.resolveConfig(abs)), filepath: abs });
    fs.writeFileSync(abs, code, "utf8");
    console.log(
      `updated ${rel} (+${list.length})${wasClean ? "" : " [prettier skipped: file was not prettier-clean]"}`
    );
  }
}

// ---------------------------------------------------------------- report

const esc = (s: string) => s.replace(/\|/g, "\\|");

function buildMarkdown(): string {
  const byFile = new Map<string, Entry[]>();
  entries.forEach((e) => byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]));
  const dynamicCount = entries.filter((e) => e.dynamic).length;

  const dup = new Map<string, number>();
  entries.filter((e) => !e.dynamic).forEach((e) => dup.set(e.id, (dup.get(e.id) ?? 0) + 1));
  const duplicates = [...dup].filter(([, n]) => n > 1);

  const L: string[] = [];
  L.push("# Test ID 목록", "");
  L.push(
    "> 이 파일은 `pnpm testid:list`(scripts/generateTestIdList.ts, Babel AST)가 자동 생성합니다. 직접 수정하지 마세요.",
    ""
  );
  L.push(`- 속성: \`${ATTR}\` (Playwright \`getByTestId()\` 기본 속성)`);
  L.push(
    '- `${...}`가 들어간 id는 동적 값입니다. 접두사로 찾으세요. 예: `[data-testid^="transaction-item-"]`'
  );
  L.push(`- 합계: 파일 ${byFile.size}개, test id ${entries.length}개 (동적 ${dynamicCount}개)`);
  L.push(`- id가 없는 상호작용 요소: ${candidates.length}개 (맨 아래 참고)`, "");
  L.push(
    "## 사용 예시",
    "",
    "```ts",
    'await page.getByTestId("sidenav-signout").click();',
    "```",
    ""
  );

  for (const [file, list] of byFile) {
    L.push(`## ${file}`, "");
    L.push(
      "| 줄 | test id | 종류 | 요소 | 컴포넌트 | 연결 방식 | UI 특징 |",
      "|---|---|---|---|---|---|---|"
    );
    for (const e of list) {
      const kind = e.dynamic ? `동적 (${e.variables.map(esc).join(", ")})` : "정적";
      L.push(
        `| ${e.line} | \`${esc(e.id)}\` | ${kind} | \`${e.element}\` | ${e.component} | ${e.carrier} | ${esc(e.features.join(", ")) || "-"} |`
      );
    }
    L.push("");
  }

  L.push("## id가 없는 상호작용 요소", "");
  L.push(
    "`pnpm testid:add`로 제안 id를 확인하고, `pnpm testid:add:write`로 반영합니다. 제안이 `-`인 항목은 직접 이름을 정해야 합니다.",
    ""
  );
  if (candidates.length === 0) {
    L.push("없음", "");
  } else {
    L.push("| 파일 | 줄 | 요소 | 컴포넌트 | 제안 id | 비고 |", "|---|---|---|---|---|---|");
    for (const c of candidates) {
      L.push(
        `| ${c.file} | ${c.line} | \`${c.element}\` | ${c.component} | ${c.proposal ? `\`${esc(c.proposal)}\`` : "-"} | ${esc(c.reason)} |`
      );
    }
    L.push("");
  }

  if (duplicates.length > 0) {
    L.push(
      "## 같은 정적 id가 여러 곳에 있음",
      "",
      "조건부 렌더링처럼 의도한 경우일 수 있습니다. 확인만 하세요.",
      ""
    );
    duplicates.forEach(([id, n]) => L.push(`- \`${id}\` (${n}곳)`));
    L.push("");
  }
  return L.join("\n");
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  scan();
  dropDelegatedCandidates();
  resolveCollisions();

  if (MODE_ADD) {
    const withProposal = candidates.filter((c) => c.proposal);
    withProposal.forEach((c) =>
      console.log(`${c.file}:${c.line}  <${c.element}>  ->  ${c.proposal}   (${c.reason})`)
    );
    candidates
      .filter((c) => !c.proposal)
      .forEach((c) =>
        console.log(`${c.file}:${c.line}  <${c.element}>  ->  (직접 지정)   (${c.reason})`)
      );
    console.log(
      `\n제안 ${withProposal.length}개, 직접 지정 필요 ${candidates.length - withProposal.length}개`
    );
    if (WRITE) {
      await applyProposals();
      // rescan so the list reflects the new ids
      entries.length = 0;
      candidates.length = 0;
      scan();
      dropDelegatedCandidates();
    } else {
      console.log("dry-run: 파일을 수정하지 않았습니다. 반영하려면 pnpm testid:add:write");
      return;
    }
  }

  const md = await prettier.format(buildMarkdown(), { parser: "markdown" });

  if (MODE_CHECK) {
    const current = fs.existsSync(OUTPUT)
      ? fs.readFileSync(OUTPUT, "utf8").replace(/\r\n/g, "\n")
      : "";
    const stale = current !== md;
    if (candidates.length > 0)
      console.error(`id가 없는 상호작용 요소 ${candidates.length}개 (pnpm testid:add 로 확인)`);
    if (stale) console.error("testid-listup.md가 최신이 아닙니다 (pnpm testid:list 실행)");
    process.exit(candidates.length > 0 || stale ? 1 : 0);
  }

  fs.writeFileSync(OUTPUT, md, "utf8");
  console.log(
    `testid-listup.md: ${entries.length} ids (${entries.filter((e) => e.dynamic).length} dynamic), ${candidates.length} elements without id`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
