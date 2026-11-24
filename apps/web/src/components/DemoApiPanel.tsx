import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { ApiExchange } from "../demo/controller";
import { KIND_LOOK } from "../demo/kindLook";

const API_LOOK = KIND_LOOK.api; // the panel has the purple of the API code

// JSON text is shown with indents; other text is shown as it is
const pretty = (text: string | undefined): string => {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const statusColor = (status: number) => (status >= 500 ? "#c62828" : status >= 400 ? "#e65100" : "#2e7d32");

const BODY_SX = {
  m: 0,
  p: 1,
  borderRadius: "4px",
  background: "#f6f6f6",
  border: "1px solid #e3e3e3",
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 110,
  overflow: "auto",
} as const;

const LABEL_SX = { display: "block", mt: 1, color: "text.secondary" } as const;

interface Props {
  /** the last API request that the shown API code sent (empty before the demo has run it) */
  exchange?: ApiExchange;
  /** how many requests this code sent in this run */
  count: number;
  open: boolean;
  onToggle: () => void;
}

/**
 * The API bar below the code of an API tool, like a request tool (Postman).
 * The bar stays; the ▲▼ button opens it to show the real request, the expected values (the expect
 * lines of the code, the real value and the result) and the real answer. It opens by itself while
 * the request is on its way, and the viewer can open it again later to look at what passed by.
 */
export default function DemoApiPanel({ exchange, count, open, onToggle }: Props) {
  const failed = exchange?.expectations.filter((item) => !item.passed).length ?? 0;
  const judged = exchange?.expectations.length ?? 0;

  return (
    <Box
      data-testid="demo-api-panel"
      data-open={open ? "true" : "false"}
      data-pending={exchange?.pending ? "true" : "false"}
      sx={{
        flexShrink: 0,
        maxHeight: "55%",
        display: "flex",
        flexDirection: "column",
        borderTop: "3px solid",
        borderTopColor: API_LOOK.activeBg,
        background: "#fff",
      }}
    >
      {/* the bar: the arrow button and a one line summary of the request */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.25, flexShrink: 0 }}>
        <IconButton
          size="small"
          onClick={onToggle}
          disabled={!exchange}
          aria-label={open ? "API 요청 접기" : "API 요청 펼치기"}
          title={open ? "접기" : "이 API 요청 보기"}
          data-testid="demo-api-toggle"
          sx={{ background: API_LOOK.idleBg, color: API_LOOK.idleText, borderRadius: "4px", "&:hover": { background: API_LOOK.idleBorder } }}
        >
          {open ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowUp fontSize="small" />}
        </IconButton>
        {exchange ? (
          <Typography variant="caption" data-testid="demo-api-summary" noWrap sx={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}>
            {exchange.method} {exchange.url}
            {" · "}
            {exchange.pending ? "전송 중…" : `${exchange.status} ${exchange.statusText} · ${exchange.ms} ms`}
            {judged > 0 && (
              <Box component="span" sx={{ ml: 1, fontWeight: 700, color: failed ? "#c62828" : "#2e7d32" }}>
                기대값 {failed ? `${failed}개 실패` : `${judged}개 통과`}
              </Box>
            )}
            {count > 1 && <Box component="span" sx={{ ml: 1, color: "text.secondary" }}>(요청 {count}개 중 마지막)</Box>}
          </Typography>
        ) : (
          <Typography variant="caption" data-testid="demo-api-summary" color="text.secondary" sx={{ flex: 1 }}>
            아직 보낸 요청이 없습니다. 시연이 이 코드를 실행하면 요청이 여기에 남습니다.
          </Typography>
        )}
      </Box>

      {open && exchange && (
        <Box data-testid="demo-api-body" sx={{ overflow: "auto", px: 1.25, pb: 1.25 }}>
          {/* the request line: method, address and a send button that shows the state */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="caption"
              data-testid="demo-api-method"
              sx={{ px: 1, py: 0.25, borderRadius: "4px", background: API_LOOK.idleBg, color: API_LOOK.idleText, fontWeight: 700, border: "1px solid", borderColor: API_LOOK.idleBorder }}
            >
              {exchange.method}
            </Typography>
            <Typography
              variant="body2"
              data-testid="demo-api-url"
              sx={{ flex: 1, minWidth: 0, fontFamily: "monospace", px: 1, py: 0.25, border: "1px solid #ddd", borderRadius: "4px", background: "#fafafa" }}
              noWrap
            >
              {exchange.url}
            </Typography>
            <Box
              data-testid="demo-api-send"
              sx={{ px: 1.5, py: 0.3, borderRadius: "4px", background: exchange.pending ? "#90caf9" : "#1976d2", color: "#fff", fontSize: 12, fontWeight: 600 }}
            >
              {exchange.pending ? "전송 중…" : "전송됨"}
            </Box>
          </Box>

          {/* the request */}
          <Typography variant="caption" sx={LABEL_SX}>
            요청 · Headers: Content-Type: application/json · Body (raw JSON)
          </Typography>
          <Box component="pre" data-testid="demo-api-request-body" sx={BODY_SX}>
            {pretty(exchange.requestBody)}
          </Box>

          {/* the expected values: the expect lines of the code, what really came, and the result */}
          <Typography variant="caption" sx={LABEL_SX}>
            기대값 · 코드의 expect 줄이 판정한 것
          </Typography>
          {exchange.expectations.length === 0 ? (
            <Typography variant="caption" data-testid="demo-api-expect-empty" sx={{ display: "block", color: "text.secondary" }}>
              {exchange.pending ? "응답을 받은 뒤 판정합니다…" : "판정한 줄이 없습니다."}
            </Typography>
          ) : (
            exchange.expectations.map((item, index) => (
              <Box
                key={index}
                data-testid="demo-api-expect"
                data-passed={item.passed ? "true" : "false"}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, mb: 0.5, borderRadius: "4px", border: "1px solid", borderColor: item.passed ? "#c8e6c9" : "#ffcdd2", background: item.passed ? "#f1f8f1" : "#fdf1f1" }}
              >
                <Typography variant="caption" sx={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}>
                  {item.code}
                  <Box component="span" sx={{ display: "block", color: "text.secondary" }}>
                    기대 {item.expected} · 실제 {item.actual}
                  </Box>
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: item.passed ? "#2e7d32" : "#c62828" }}>
                  {item.passed ? "통과" : "실패"}
                </Typography>
              </Box>
            ))
          )}

          {/* the answer */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              응답
            </Typography>
            {exchange.pending ? (
              <Typography variant="caption" data-testid="demo-api-waiting" sx={{ color: "text.secondary" }}>
                서버의 답을 기다립니다…
              </Typography>
            ) : (
              <>
                <Typography variant="caption" data-testid="demo-api-status" sx={{ fontWeight: 700, color: statusColor(exchange.status ?? 0) }}>
                  {exchange.status} {exchange.statusText}
                </Typography>
                <Typography variant="caption" data-testid="demo-api-time" sx={{ color: "text.secondary" }}>
                  {exchange.ms} ms
                </Typography>
                {exchange.contentType && (
                  <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                    {exchange.contentType}
                  </Typography>
                )}
              </>
            )}
          </Box>
          {!exchange.pending && (
            <Box component="pre" data-testid="demo-api-response-body" sx={{ ...BODY_SX, mt: 0.5 }}>
              {pretty(exchange.responseBody) || "(본문 없음)"}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
