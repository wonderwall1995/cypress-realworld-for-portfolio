import React from "react";
import { Box } from "@mui/material";
import { DemoState, demoQueue } from "../demo/queue";
import { KIND_LOOK } from "../demo/kindLook";

// how many cards fit in the height of the screen at once
const CARDS_IN_VIEW = 12;
const CARD_GAP = 4; // px between two cards
const LIST_PADDING = 8; // px around the list
// below this height a card would be too low for its two lines: the list scrolls instead
const CARD_MIN_HEIGHT = 40;

interface Props {
  /** the button "테스트 별 코드 확인" in the header of the accordion opens and closes the cards */
  open: boolean;
  state: DemoState;
  /** index in the queue of the test that runs (or ran last) */
  runningIndex: number;
  /** index in the queue of the test whose code is shown now */
  viewIndex: number;
  onPick: (index: number) => void;
}

/**
 * The cards of the "시연" tab, one card for each test (each *.spec.ts file).
 * They take the place of the code screen while the button "테스트 별 코드 확인" is on; picking a card
 * closes them and shows the code of that test again.
 * - A card is named like the file, for example 000-demo-testing.spec.ts, and it spreads over the whole width.
 * - Under the name, small chips show the codes that the test depends on (API tools, common code).
 * - The height of a card is one 12th of the screen, so 12 cards are in view at once.
 * - The first test is the lowest card and the cards stack upward.
 */
export default function DemoCards({ open, state, runningIndex, viewIndex, onPick }: Props) {
  if (!open) return null;
  return (
    <Box
      data-testid="demo-cards"
      sx={{
        // the cards take the place of the code screen
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "auto",
        p: `${LIST_PADDING}px`,
        background: "#fafafa",
        display: "flex",
        // the first card (the first test) is the lowest one, the next tests stack upward
        flexDirection: "column-reverse",
        gap: `${CARD_GAP}px`,
      }}
    >
      {demoQueue.map((test, at) => {
        const viewed = at === viewIndex;
        const running = state !== "idle" && at === runningIndex;
        const dependencies = test.files.slice(1); // the first file is the test itself
        return (
          <Box
            key={test.path}
            component="button"
            type="button"
            onClick={() => onPick(at)}
            title={test.path}
            data-testid="demo-card"
            data-index={at}
            data-viewed={viewed ? "true" : undefined}
            data-running={running ? "true" : undefined}
            sx={{
              // one 12th of the height of the list, minus the gaps between the cards
              flex: `0 0 calc((100% - ${(CARDS_IN_VIEW - 1) * CARD_GAP}px) / ${CARDS_IN_VIEW})`,
              minHeight: CARD_MIN_HEIGHT,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: 0.5,
              textAlign: "left",
              border: "1px solid",
              borderColor: viewed ? "#1976d2" : "#d6d6d6",
              borderLeft: "4px solid",
              borderLeftColor: running ? "#2e7d32" : viewed ? "#1976d2" : "#bdbdbd",
              borderRadius: "4px",
              background: viewed ? "#e3f2fd" : "#fff",
              px: 1.25,
              cursor: "pointer",
              overflow: "hidden",
              "&:hover": { background: viewed ? "#e3f2fd" : "#f3f3f3" },
            }}
          >
            {/* the name of the card: the file name */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, width: "100%", minWidth: 0 }}>
              {running && (
                <span title="실행 중" style={{ color: "#2e7d32", fontSize: 10, flexShrink: 0 }}>
                  ●
                </span>
              )}
              <span
                style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "#1d1d1d", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {test.name}
              </span>
              {running && <span style={{ color: "#2e7d32", fontSize: 11, flexShrink: 0 }}>실행 중</span>}
            </Box>

            {/* the codes that this test depends on, small */}
            <Box
              data-testid="demo-card-dependencies"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%", minWidth: 0, overflow: "hidden", flexWrap: "nowrap" }}
            >
              <span style={{ fontSize: 10.5, color: "#757575", flexShrink: 0 }}>
                {dependencies.length > 0 ? `하위 코드 ${dependencies.length}개` : "하위 코드 없음"}
              </span>
              {dependencies.map((file) => {
                const look = KIND_LOOK[file.kind];
                return (
                  <span
                    key={file.path}
                    data-testid="demo-card-dependency"
                    data-kind={file.kind}
                    title={`${file.path} (${look.label})`}
                    style={{
                      fontSize: 10.5,
                      lineHeight: 1.3,
                      padding: "0 6px",
                      borderRadius: 3,
                      border: `1px solid ${look.idleBorder}`,
                      background: look.idleBg,
                      color: look.idleText,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {file.name}
                  </span>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
