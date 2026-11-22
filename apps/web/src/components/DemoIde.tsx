import React from "react";
import { Box, Typography } from "@mui/material";
import { DemoFile, DemoState, e2eSnapshot } from "../demo/queue";
import { KIND_LOOK } from "../demo/kindLook";

const E2E_PREFIX = "tests/e2e/";
const LINE_BREAK = /\r?\n/;

// the path inside tests/e2e, for example common/signup.ts
const inside = (file: DemoFile) => file.path.slice(E2E_PREFIX.length);
// the folder of a file inside tests/e2e ("" for a file that lies directly in tests/e2e)
const folderOf = (file: DemoFile) => (inside(file).includes("/") ? inside(file).split("/")[0] : "");

// The line between two groups of the list (api / common / the files in tests/e2e itself).
// It keeps only 2px of space above and below it.
const GROUP_LINE_SX = { borderTop: "1px solid #c8c8c8", my: "2px" } as const;

// "./common/signup" or "../api/login" in an import line
const IMPORT = /from\s+["'](\.{1,2}\/[^"']+)["']/g;

// the path of the file that an import line points to, for example tests/e2e/common/signup.ts
const resolveImport = (from: DemoFile, specifier: string): string => {
  const parts = from.path.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `${parts.join("/")}.ts`;
};

/** The code files that this file imports (its sub codes): API tools first, then the common code. */
const subCodesOf = (file: DemoFile): DemoFile[] => {
  const paths = Array.from(file.code.matchAll(IMPORT)).map((match) => resolveImport(file, match[1]));
  const found = Array.from(new Set(paths))
    .map((path) => e2eSnapshot.find((item) => item.path === path))
    .filter((item): item is DemoFile => !!item);
  const rank = (item: DemoFile) =>
    item.kind === "api" ? 0 : item.kind === "common" ? 1 : item.kind === "fixture" ? 2 : 3;
  return found.sort((a, b) => rank(a) - rank(b));
};

interface Props {
  state: DemoState;
  /** the file that runs now: it gets a green dot in the list */
  activeFile?: string;
}

/**
 * The IDE tab: a snapshot of the folder tests/e2e, in the design of the DB tab.
 *
 *   | the chosen file (path, kind)
 *   files and folders (pick one) | the code of the file, with line numbers
 *
 * The files are read when the page is built, so this is a copy of the folder at that moment.
 */
export default function DemoIde({ state, activeFile }: Props) {
  const [selected, setSelected] = React.useState<string | undefined>();

  const file =
    e2eSnapshot.find((item) => item.path === selected) ??
    e2eSnapshot.find((item) => item.kind === "test") ??
    e2eSnapshot[0];

  // folders first (api, common, ...), then the files that lie directly in tests/e2e
  const folders = Array.from(new Set(e2eSnapshot.map(folderOf)))
    .filter((folder) => folder !== "")
    .sort();
  const rootFiles = e2eSnapshot.filter((item) => folderOf(item) === "");

  const row = (item: DemoFile, indent: number) => {
    const active = item.path === file?.path;
    const look = KIND_LOOK[item.kind];
    const running = state !== "idle" && item.path === activeFile;
    return (
      <Box
        key={item.path}
        component="button"
        type="button"
        data-testid="demo-ide-file-item"
        data-path={item.path}
        data-kind={item.kind}
        data-active={active}
        onClick={() => setSelected(item.path)}
        title={item.path}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          width: "100%",
          textAlign: "left",
          border: 0,
          borderLeft: "3px solid",
          borderLeftColor: active ? "#1976d2" : "transparent",
          background: active ? "#e3f2fd" : "transparent",
          pl: 1.25 + indent * 1.5,
          pr: 1,
          py: 0.8,
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: 12.5,
          color: "#1d1d1d",
          "&:hover": { background: active ? "#e3f2fd" : "#f0f0f0" },
        }}
      >
        {/* a small square in the color of the kind of the file */}
        <span
          style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: look.idleBorder, border: `1px solid ${look.activeBorder}` }}
        />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontWeight: active ? 700 : 400 }}>
          {item.name}
        </span>
        {running && (
          <span data-testid="demo-ide-running" title="실행 중" style={{ color: "#2e7d32", fontSize: 10 }}>
            ●
          </span>
        )}
      </Box>
    );
  };

  const lines = file ? file.code.split(LINE_BREAK) : [];
  const subCodes = file ? subCodesOf(file) : [];

  return (
    <Box
      data-testid="demo-ide-area"
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: "1px solid #ddd" }}>
        <Typography variant="caption" color="text.secondary" data-testid="demo-ide-summary">
          {E2E_PREFIX} 스냅샷 · 파일 {e2eSnapshot.length}개
        </Typography>
      </Box>

      {!file && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
          tests/e2e 안에 파일이 없습니다.
        </Typography>
      )}

      {file && (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* left: the folders and files of tests/e2e (pick one) */}
          <Box
            data-testid="demo-ide-filelist"
            sx={{ width: 190, flexShrink: 0, overflow: "auto", borderRight: "1px solid #ddd", background: "#fafafa", py: 0.5 }}
          >
            <Typography variant="caption" sx={{ display: "block", px: 1.5, py: 0.5, color: "#757575", fontFamily: "monospace" }}>
              e2e/
            </Typography>
            {folders.map((folder, at) => (
              <Box key={folder}>
                {at > 0 && <Box data-testid="demo-ide-line" sx={GROUP_LINE_SX} />}
                <Typography
                  variant="caption"
                  data-testid="demo-ide-folder"
                  sx={{ display: "block", pl: 2, pr: 1, py: 0.4, color: "#616161", fontFamily: "monospace", fontWeight: 600 }}
                >
                  {folder}/
                </Typography>
                {e2eSnapshot.filter((item) => folderOf(item) === folder).map((item) => row(item, 1))}
              </Box>
            ))}
            {folders.length > 0 && rootFiles.length > 0 && <Box data-testid="demo-ide-line" sx={GROUP_LINE_SX} />}
            {rootFiles.map((item) => row(item, 0))}
          </Box>

          {/* right: the code of the chosen file */}
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Box sx={{ px: 1.5, py: 0.75, borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" data-testid="demo-ide-path" sx={{ flex: 1, fontFamily: "monospace", minWidth: 0 }} noWrap>
                {file.path}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  px: 0.75,
                  borderRadius: "4px",
                  border: "1px solid",
                  borderColor: KIND_LOOK[file.kind].idleBorder,
                  background: KIND_LOOK[file.kind].idleBg,
                  color: KIND_LOOK[file.kind].idleText,
                }}
              >
                {KIND_LOOK[file.kind].label}
              </Typography>
            </Box>
            <Box
              data-testid="demo-ide-code"
              sx={{ flex: 1, minHeight: 0, overflow: "auto", background: "#000", color: "#fff", py: 1, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
            >
              {lines.map((text, index) => (
                <Box key={index} sx={{ display: "flex" }}>
                  <Box sx={{ width: 44, flexShrink: 0, pr: 1.5, textAlign: "right", color: "#777", userSelect: "none" }}>
                    {index + 1}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", pr: 1 }}>{text || " "}</Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ px: 1.5, py: 0.5, borderTop: "1px solid #ddd" }}>
              <Typography variant="caption" color="text.secondary" data-testid="demo-ide-lines">
                {file.name} · {lines.length}줄
              </Typography>
            </Box>
            {/* the box right below: the sub codes that this code uses (the files it imports) */}
            <Box
              data-testid="demo-ide-subcodes"
              sx={{ px: 1.5, py: 0.75, borderTop: "1px solid #ddd", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75 }}
            >
              <Typography variant="caption" color="text.secondary" data-testid="demo-ide-subcodes-title">
                {subCodes.length > 0 ? `하위 코드 ${subCodes.length}개` : "하위 코드 없음"}
              </Typography>
              {subCodes.map((sub) => {
                const look = KIND_LOOK[sub.kind];
                return (
                  <Box
                    key={sub.path}
                    component="button"
                    type="button"
                    data-testid="demo-ide-subcode"
                    data-path={sub.path}
                    data-kind={sub.kind}
                    title={`${sub.path} (누르면 이 파일을 봅니다)`}
                    onClick={() => setSelected(sub.path)}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      px: 1,
                      py: 0.3,
                      border: "1px solid",
                      borderColor: look.idleBorder,
                      borderRadius: "4px",
                      background: look.idleBg,
                      color: look.idleText,
                      fontSize: 12,
                      lineHeight: 1.25,
                      cursor: "pointer",
                      "&:hover": { borderColor: look.activeBorder, filter: "brightness(0.96)" },
                    }}
                  >
                    <span>{sub.name}</span>
                    <span style={{ fontSize: 10, opacity: 0.85 }}>{look.label}</span>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
