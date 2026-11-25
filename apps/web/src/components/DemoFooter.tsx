import React from "react";
import { Box, Button, IconButton, Typography } from "@mui/material";
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { DemoState } from "../demo/queue";
import { DEMO_Z_INDEX, MOBILE_FOOTER_SPACE } from "../demo/layout";
import { useMobileDesktopViewport } from "./MobileDesktopViewport";

interface Props {
  state: DemoState;
  hasPrev: boolean;
  hasNext: boolean;
  /** data-testid of the UI the current step works on (left area) */
  currentTestId?: string;
  /** which test of how many runs now (right area); empty while no demo runs */
  progress?: { current: number; total: number };
  /** only one test runs (부분 실행) */
  single?: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
}

/**
 * Footer of the whole web, like the control bar of a video player (centred):
 * [<] [시연 시작] [|| or ▶] [■ stop, red] [>]
 * "시연 시작" stays in place while the demo runs, but it is dimmed and cannot be pressed.
 * After the demo has ended it can be pressed again (it starts from the first test, or asks when a test is picked).
 */
export default function DemoFooter({
  state,
  hasPrev,
  hasNext,
  currentTestId,
  progress,
  single,
  onStart,
  onTogglePause,
  onPrev,
  onNext,
  onStop,
}: Props) {
  const { mobile, scale } = useMobileDesktopViewport();
  const idle = state === "idle";
  const canToggle = state === "running" || state === "paused"; // not after the queue has ended
  return (
    <Box
      component="footer"
      data-testid="demo-footer"
      sx={{
        position: "relative",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: DEMO_Z_INDEX + 1,
        height: MOBILE_FOOTER_SPACE,
        paddingBottom: mobile ? "env(safe-area-inset-bottom, 0px)" : 0,
        flexShrink: 0,
        // three areas: the current testid (left), the demo controls (middle), an empty area (right)
        display: "grid",
        gridTemplateColumns: mobile ? "minmax(0, 1fr) auto" : "1fr auto 1fr",
        ...(mobile
          ? {
              "& > :first-of-type": { display: "none" },
              "& .MuiIconButton-root": { width: 40 / scale, height: 40 / scale },
              "& .MuiIconButton-root svg": { fontSize: 24 / scale },
              "& .MuiButton-root": {
                minHeight: 40 / scale,
                minWidth: 68 / scale,
                fontSize: 12 / scale,
              },
            }
          : {}),
        alignItems: "center",
        columnGap: mobile ? `${4 / scale}px` : 2,
        px: mobile ? `${8 / scale}px` : 2,
        borderTop: "1px solid #ddd",
        background: "#fff",
      }}
    >
      <TestIdArea label="현재 TID" testId={currentTestId} testid="demo-current-tid" />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: mobile ? `${4 / scale}px` : 1,
        }}
      >
        <IconButton
          size="small"
          onClick={onPrev}
          disabled={idle || !hasPrev}
          aria-label="이전 테스트"
          data-testid="demo-prev"
        >
          <PrevIcon />
        </IconButton>
        <Button
          variant="contained"
          size="small"
          onClick={onStart}
          disabled={!(idle || state === "finished")}
          data-testid="demo-start"
          sx={{ textTransform: "none" }}
        >
          시연 시작
        </Button>
        <IconButton
          size="small"
          onClick={onTogglePause}
          disabled={!canToggle}
          aria-label={state === "running" ? "일시정지" : "계속"}
          data-testid="demo-toggle"
          data-state={state}
        >
          {state === "running" ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={onStop}
          disabled={idle}
          aria-label="시연 중지"
          title="시연 중지"
          data-testid="demo-stop"
          // One plain red stop icon in every state (before, while and after the demo). It has no round ripple and no
          // round focus circle: they were drawn around the icon and made the button look like two buttons.
          disableRipple
          sx={{ "&:hover, &.Mui-focusVisible": { background: "transparent" } }}
        >
          <StopIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={onNext}
          disabled={idle || !hasNext}
          aria-label="다음 테스트"
          data-testid="demo-forward"
        >
          <NextIcon />
        </IconButton>
      </Box>
      {/* the right area: which test of how many (empty while no demo runs) */}
      <Box
        sx={{
          minWidth: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "baseline",
          gap: 1,
        }}
      >
        {progress && (
          <Box
            data-testid="demo-progress"
            title="지금 실행 중인 테스트 / 전체 테스트"
            sx={{ display: "flex", alignItems: "baseline", gap: 1, whiteSpace: "nowrap" }}
          >
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontSize: 12, display: mobile ? "none" : "block" }}
            >
              {single ? "부분 실행" : "테스트"}
            </Typography>
            <Box
              component="span"
              sx={{
                fontSize: mobile ? 12 / scale : 22,
                fontWeight: 800,
                lineHeight: 1,
                color: "#1976d2",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
              }}
            >
              {progress.current} / {progress.total}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// a clear code font: a bold monospace font at a small size looks smeared, so it is regular and 13px
const TEST_ID_FONT =
  '"Cascadia Mono", "Cascadia Code", Consolas, "D2Coding", "Courier New", monospace';

/** Left area of the footer: the testid of the UI the current step works on (empty when there is none). */
function TestIdArea({ label, testId, testid }: { label: string; testId?: string; testid: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      {testId && (
        <Box
          data-testid={testid}
          title={`${label}: ${testId}`}
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", flexShrink: 0, fontSize: 12 }}
          >
            {label}
          </Typography>
          <Box
            component="span"
            sx={{
              fontFamily: TEST_ID_FONT,
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: 0,
              color: "#1d1d1d",
              background: "#f1f3f4",
              borderRadius: "4px",
              px: 0.75,
              py: 0.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {testId}
          </Box>
        </Box>
      )}
    </Box>
  );
}
