import React from "react";
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { DemoState, DemoTest, demoQueue } from "../demo/queue";
import { KIND_LOOK } from "../demo/kindLook";
import DbSnapshot from "./DbSnapshot";
import DemoIde from "./DemoIde";
import DemoApiPanel from "./DemoApiPanel";
import DemoCards from "./DemoCards";
import type { ApiExchange } from "../demo/controller";

const MIN_WIDTH = 360; // it cannot get narrower than this
const DEFAULT_WIDTH = 840; // the width it opens with (kept inside the limits below on a small window)
const MAX_WIDTH_RATIO = 0.7; // it can be dragged left up to this part of the window
const BUTTON_SIZE = 26; // fold / unfold button
const HEADER_PADDING = 12; // space around the button and between the button and the file name
const FOLDED_WIDTH = BUTTON_SIZE + HEADER_PADDING * 2; // the folded strip fits the button and its padding

const LINE_BREAK = /\r?\n/; // the code is split into lines, so one line can be underlined

const MESSAGE_ROW_HEIGHT = 28; // the place of the end message (a row that is empty until there is a message)

const VIEW_TITLE = { demo: "", ide: "tests/e2e 스냅샷", db: "DB 스냅샷" } as const;

// the 시연 / IDE / DB switch in the header: the chosen one is filled with the blue of the web
const VIEW_TAB_SX = {
  textTransform: "none",
  px: 1.5,
  py: 0.25,
  fontSize: 13,
  fontWeight: 600,
  "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: "#1976d2", color: "#fff" },
} as const;

const FLASH_MS = 450; // how long the feedback for a code change lasts
// the code area (black) fades from a light blue tint to nothing
const codeFlash = keyframes`
  from { background-color: rgba(144, 202, 249, 0.35); }
  to { background-color: rgba(144, 202, 249, 0); }
`;
// the new tab grows a little and gets a soft ring in the color of its kind, then calms down
const tabPulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 var(--tab-ring); }
  40% { transform: scale(1.14); box-shadow: 0 0 0 6px var(--tab-ring-soft); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
`;

const maxWidth = () => Math.max(MIN_WIDTH, window.innerWidth * MAX_WIDTH_RATIO);

interface Props {
  /** the test that is running now: its file and the shared files it imports are the tabs */
  current: DemoTest;
  /** the test that runs next, if any (its full path is shown at the bottom) */
  next?: DemoTest;
  state: DemoState;
  /** index in the queue of `current` (the card list marks the test that runs) */
  index: number;
  /** the file (path from the repository root) and line of the test code that runs now: the tab follows it, the line is underlined */
  activeFile?: string;
  activeLine?: number;
  /** why the demo stopped, when a step failed */
  error?: string;
  /** the API request that is on its way now: the API bar opens by itself while it is there */
  api?: ApiExchange;
  /** every API request of this run: the API bar can show them again after they have passed */
  apis?: ApiExchange[];
  /** only one test runs (부분 실행) */
  single?: boolean;
  /** tells which test the viewer picked and looks at now (the 시연 tab is open); undefined when there is none */
  onChoose: (index: number | undefined) => void;
}

/**
 * Accordion at the right of the screen. It is always there (also when no demo runs), so it can always be
 * folded and unfolded. It starts folded and opens by itself when the demo starts (the footer bar starts and
 * stops the demo). The screen gets narrower by the width of this panel.
 * - Header tabs: 시연 (the code of the running test), IDE (a snapshot of the folder tests/e2e), DB (a snapshot of the database).
 * - Drag its left edge to the left to make it wider (the code is easier to read).
 * - The arrow in the header folds it to a thin strip and unfolds it. Folding does not stop the demo.
 * - The tabs at the bottom switch between the test file and the shared files it uses.
 */
export default function DemoAccordion({ current, next, state, index, activeFile, activeLine, error, api, apis, single, onChoose }: Props) {
  const [width, setWidth] = React.useState(() => Math.min(DEFAULT_WIDTH, maxWidth()));
  // The accordion is always on screen, so it can always be folded and unfolded (also when no demo runs).
  // It starts folded, so the first screen (sign in) keeps its full width until the demo starts.
  const [folded, setFolded] = React.useState(true);
  const [picked, setPicked] = React.useState(0);
  // "demo": the "시연" tab, the code of the running test. "ide": the "IDE" tab, a snapshot of the folder tests/e2e.
  // "db": the "DB" tab, a snapshot of the database.
  const [view, setView] = React.useState<"demo" | "ide" | "db">("ide");
  const drag = React.useRef<{ startX: number; startWidth: number } | null>(null);

  // When a demo starts the accordion opens on the "시연" tab (the running code). When it is stopped it shows the IDE tab again.
  const previousState = React.useRef(state);
  React.useEffect(() => {
    const before = previousState.current;
    previousState.current = state;
    if (state === "running" && (before === "idle" || before === "finished")) {
      setFolded(false);
      setView("demo");
      setPinned(undefined);
      if (!single) setChosen(undefined); // all tests run: the pick is over
    } else if (state === "idle" && before !== "idle") {
      setView("ide");
      setPinned(undefined);
      setChosen(undefined);
    }
  }, [state, single]);

  // Which test the "시연" tab shows. It follows the test that runs. A card ("테스트 별 코드 확인") can pick another one;
  // the pick ends when the run moves to another test.
  const [pinned, setPinned] = React.useState<number | undefined>();
  const [cardsOpen, setCardsOpen] = React.useState(false);
  // The pick itself, kept also while its test runs alone. It counts only while the viewer looks at the 시연 tab.
  const [chosen, setChosen] = React.useState<number | undefined>();
  const chosenInView = folded || view !== "demo" ? undefined : chosen;
  React.useEffect(() => onChoose(chosenInView), [onChoose, chosenInView]);
  React.useEffect(() => setPinned(undefined), [index]);
  const viewIndex = pinned ?? index;
  const viewed = demoQueue[viewIndex] ?? current;
  const viewsRunning = viewed.path === current.path;

  // a test starts with its own file again
  React.useEffect(() => setPicked(0), [viewed.path]);

  // the tab follows the code that runs now (for example it moves to signup.ts inside the sign-up helper)
  React.useEffect(() => {
    if (!viewsRunning) return;
    const at = viewed.files.findIndex((file) => file.path === activeFile);
    if (at >= 0) setPicked(at);
  }, [activeFile, viewed, viewsRunning]);

  const shown = viewed.files[picked] ?? viewed.files[0];
  // the running line is marked only when the shown test is the one that runs
  const runningLine = viewsRunning && shown.path === activeFile ? activeLine : undefined;

  // Feedback when the code that is shown changes: the code area flashes and the new tab pulses.
  // `changeId` is part of their keys, so every change starts the animation again.
  const [changeId, setChangeId] = React.useState(0);
  const [flashing, setFlashing] = React.useState(false);
  const previousPath = React.useRef(shown.path);
  React.useEffect(() => {
    if (previousPath.current === shown.path) return;
    previousPath.current = shown.path;
    setChangeId((id) => id + 1);
    setFlashing(true);
    const timer = window.setTimeout(() => setFlashing(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [shown.path]);

  // The API bar: it opens by itself while a request is on its way and closes when the step is over.
  // The viewer can open it again with the arrow button (and then it stays as the viewer chose).
  const exchangesOfShown = (apis ?? []).filter((item) => item.path === shown.path);
  const [apiOpen, setApiOpen] = React.useState(false);
  const apiAutoOpened = React.useRef(false);
  const liveId = api?.id;
  React.useEffect(() => {
    if (liveId !== undefined) {
      apiAutoOpened.current = true;
      setApiOpen(true);
    } else if (apiAutoOpened.current) {
      apiAutoOpened.current = false;
      setApiOpen(false);
    }
  }, [liveId]);

  const lineRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    lineRef.current?.scrollIntoView({ block: "nearest" });
  }, [runningLine, picked, folded, changeId, view, api?.id, apiOpen, cardsOpen]); // when the API bar opens the code area gets smaller: keep the running line in view

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const wanted = drag.current.startWidth + (drag.current.startX - event.clientX);
    setWidth(Math.min(maxWidth(), Math.max(MIN_WIDTH, wanted)));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <Box
      data-testid="demo-accordion"
      data-folded={folded}
      sx={{
        position: "relative",
        flexShrink: 0,
        width: folded ? FOLDED_WIDTH : width,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #ddd",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {!folded && (
        <Box
          data-testid="demo-accordion-resize"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: "col-resize",
            zIndex: 1,
            touchAction: "none",
            "&:hover": { background: "rgba(25,118,210,0.25)" },
          }}
        />
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: `${HEADER_PADDING}px`,
          borderBottom: folded ? "none" : "1px solid #ddd",
        }}
      >
        <Button
          variant="contained"
          onClick={() => setFolded(!folded)}
          aria-label={folded ? "펼치기" : "접기"}
          title={folded ? "펼치기" : "접기"}
          data-testid="demo-accordion-fold"
          sx={{ minWidth: 0, width: BUTTON_SIZE, height: BUTTON_SIZE, p: 0, flexShrink: 0 }}
        >
          {folded ? <ChevronLeft sx={{ fontSize: 20 }} /> : <ChevronRight sx={{ fontSize: 20 }} />}
        </Button>
        {!folded && (
          <>
            <Typography
              variant="subtitle2"
              data-testid="demo-file-name"
              title={view === "demo" ? shown.path : VIEW_TITLE[view]}
              noWrap
              sx={{ ml: `${HEADER_PADDING}px`, flex: 1, minWidth: 0 }}
            >
              {view === "demo" ? shown.name : VIEW_TITLE[view]}
            </Typography>
            {/* directly left of the 시연 tab, and only while the 시연 tab is chosen: it opens the cards of the tests */}
            {view === "demo" && (
              <Button
                size="small"
                variant={cardsOpen ? "contained" : "outlined"}
                onClick={() => setCardsOpen((open) => !open)}
                aria-pressed={cardsOpen}
                title={cardsOpen ? "카드 목록 닫기" : "테스트 별 코드 확인"}
                data-testid="demo-cards-toggle"
                data-open={cardsOpen ? "true" : "false"}
                sx={{ ml: `${HEADER_PADDING}px`, flexShrink: 0, textTransform: "none", fontSize: 13, fontWeight: 600, py: 0.25, whiteSpace: "nowrap" }}
              >
                테스트 별 코드 확인
              </Button>
            )}
            {/* the right area of the header: the test code (시연), the folder (IDE) and the database (DB) */}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={view}
              onChange={(_event, next) => next && setView(next)}
              aria-label="보기 전환"
              data-testid="demo-view-toggle"
              sx={{ ml: `${HEADER_PADDING}px`, flexShrink: 0 }}
            >
              <ToggleButton value="demo" data-testid="demo-view-demo" sx={VIEW_TAB_SX}>
                시연
              </ToggleButton>
              <ToggleButton value="ide" data-testid="demo-view-ide" sx={VIEW_TAB_SX}>
                IDE
              </ToggleButton>
              <ToggleButton value="db" data-testid="demo-view-db" sx={VIEW_TAB_SX}>
                DB
              </ToggleButton>
            </ToggleButtonGroup>
          </>
        )}
      </Box>
      {!folded && (
        <>
          {/* the IDE tab: a snapshot of the folder tests/e2e (files on the left, the code of the chosen file on the right) */}
          {view === "ide" && <DemoIde state={state} activeFile={activeFile} />}
          {/* the DB tab asks the server for a snapshot each time it opens */}
          {view === "db" && <DbSnapshot />}
          {/* the 시연 tab: the cards (opened by the button in the header) on the left, the code of the shown test (white on black) on the right */}
          {view === "demo" && (
          <Box data-testid="demo-code-row" sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          <DemoCards
            open={cardsOpen}
            state={state}
            runningIndex={index}
            viewIndex={viewIndex}
            onPick={(at) => {
              setPinned(at === index ? undefined : at);
              setChosen(at);
              setCardsOpen(false); // the picked card brings the code screen back
            }}
          />
          {/* while the cards are open they take the place of the code screen */}
          {!cardsOpen && (
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Box
            data-testid="demo-code-area"
            sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1, background: "#000", color: "#fff" }}
          >
            <Box
              key={changeId}
              data-testid="demo-code"
              data-flashing={flashing ? "true" : undefined}
              sx={{
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                borderRadius: "4px",
                ...(flashing && changeId > 0 ? { animation: `${codeFlash} ${FLASH_MS}ms ease-out` } : {}),
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }}
            >
              {shown.code.split(LINE_BREAK).map((text, lineIndex) => {
                const running = runningLine === lineIndex + 1;
                return (
                  <Box
                    key={lineIndex}
                    data-testid="demo-code-line"
                    ref={running ? lineRef : undefined}
                    data-line={lineIndex + 1}
                    data-running={running ? "true" : undefined}
                    sx={
                      running
                        ? {
                            // the highlight has the color of the kind of the file: green for a test, purple for API, ivory for common
                            background: KIND_LOOK[shown.kind].lineBg,
                            borderBottom: `2px solid ${KIND_LOOK[shown.kind].lineBorder}`,
                          }
                        : { borderBottom: "2px solid transparent" }
                    }
                  >
                    {text || " "}
                  </Box>
                );
              })}
            </Box>
          </Box>
          {/* below the code of an API tool: the API bar with the ▲▼ button */}
          {shown.kind === "api" && (
            <DemoApiPanel
              exchange={exchangesOfShown[exchangesOfShown.length - 1]}
              count={exchangesOfShown.length}
              open={apiOpen}
              onToggle={() => {
                apiAutoOpened.current = false; // the viewer chose: the panel stays as chosen
                setApiOpen((open) => !open);
              }}
            />
          )}
          </Box>
          )}
          </Box>
          )}
          {/* the bottom block never shrinks away: the code and the API panel give way to it */}
          <Box sx={{ borderTop: "1px solid #ddd", flexShrink: 0 }}>
            {/* The message row always has its place (it is empty until there is a message),
                so the end message does not push the code and the tabs around. */}
            <Box data-testid="demo-message-row" sx={{ minHeight: MESSAGE_ROW_HEIGHT, px: 1, pt: 1 }}>
              {error && (
                <Typography variant="caption" color="error" data-testid="demo-error" sx={{ display: "block" }}>
                  실패: {error}
                </Typography>
              )}
              {state === "finished" && !error && (
                <Typography variant="caption" data-testid="demo-finished" sx={{ display: "block", color: "#2e7d32" }}>
                  시연이 끝났습니다. ■를 누르면 처음 상태로 돌아갑니다.
                </Typography>
              )}
            </Box>
            {view === "demo" && viewed.files.length > 1 && (
              <Box sx={{ display: "flex", gap: 0.5, px: 1, pt: 1, flexWrap: "wrap" }}>
                {viewed.files.map((file) => {
                  const active = file.path === shown.path;
                  const look = KIND_LOOK[file.kind];
                  return (
                    <Button
                      // the tab that is shown starts over (new key) at every change, so it pulses once
                      key={active ? `${file.path}#${changeId}` : file.path}
                      size="small"
                      disableElevation
                      onClick={() => setPicked(viewed.files.indexOf(file))}
                      title={file.path}
                      data-testid="demo-tab"
                      data-active={active}
                      data-kind={file.kind}
                      sx={{
                        textTransform: "none",
                        minWidth: 0,
                        border: "1px solid",
                        // two lines: the file name, then the kind of the code
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        lineHeight: 1.25,
                        py: 0.4,
                        backgroundColor: active ? look.activeBg : look.idleBg,
                        color: active ? look.activeText : look.idleText,
                        borderColor: active ? look.activeBorder : look.idleBorder,
                        boxShadow: active ? 1 : "none",
                        "&:hover": {
                          backgroundColor: active ? look.activeBg : look.idleBg,
                          borderColor: look.activeBorder,
                          filter: "brightness(0.96)",
                        },
                        "--tab-ring": `rgba(${look.ring}, 0.55)`,
                        "--tab-ring-soft": `rgba(${look.ring}, 0.25)`,
                        ...(flashing && changeId > 0 && active
                          ? { animation: `${tabPulse} ${FLASH_MS}ms ease-out` }
                          : {}),
                        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                      }}
                    >
                      <span>{file.name}</span>
                      <span style={{ fontSize: 10, opacity: 0.85 }}>{look.label}</span>
                    </Button>
                  );
                })}
              </Box>
            )}
            <Box sx={{ p: 1 }}>
              <Typography variant="caption" data-testid="demo-next" color="text.secondary">
                다음 테스트: {next ? next.path : single ? "없음 (부분 실행)" : "없음"}
              </Typography>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
