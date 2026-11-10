import React, { useEffect, useRef, useState } from "react";
import { Box, Button, FormHelperText, InputBase, Typography } from "@mui/material";
import {
  DateBox,
  DateRangeBoxName,
  DateRangeError,
  TransactionDateRangePayload,
  buildDateRange,
  dateIsoToBox,
} from "@rwa/shared";

const APPLY_DELAY_MS = 400;

const errorText = (error: DateRangeError, boxes: DateRangeBoxName[]) => {
  const who = boxes.length === 2 ? "시작일과 종료일" : boxes[0] === "start" ? "시작일" : "종료일";
  switch (error) {
    case "incomplete":
      return `${who}의 연·월·일을 모두 입력하세요`;
    case "format":
      return `${who}: 연도는 4자리, 월·일은 1~2자리 숫자로 입력하세요`;
    case "invalid-date":
      return `${who}: 존재하지 않는 날짜입니다`;
    case "order":
      return "시작일이 종료일보다 늦을 수 없습니다";
  }
};

// ---------------------------------------------------------------- one date box: [YYYY] / [MM] / [DD]

type Part = "year" | "month" | "day";
const PARTS: { part: Part; max: number; width: number; placeholder: string; label: string }[] = [
  { part: "year", max: 4, width: 45, placeholder: "YYYY", label: "연" },
  { part: "month", max: 2, width: 27, placeholder: "MM", label: "월" },
  { part: "day", max: 2, width: 27, placeholder: "DD", label: "일" },
];

type DatePartsBoxProps = {
  title: string;
  testIdPrefix: string;
  value: DateBox;
  onChange: (value: DateBox) => void;
  invalid: boolean;
};

/**
 * One date = one box with three entry fields. The "/" between them is a real, dark character,
 * not a hint. Digits only; when a field is full the cursor moves on; "/" also moves on;
 * Backspace in an empty field goes back; pasting "2026/11/09" fills all three.
 */
const DatePartsBox: React.FC<DatePartsBoxProps> = ({
  title,
  testIdPrefix,
  value,
  onChange,
  invalid,
}) => {
  const refs = useRef<Record<Part, HTMLInputElement | null>>({
    year: null,
    month: null,
    day: null,
  });
  const focus = (part?: Part) => part && refs.current[part]?.focus();
  const next = (part: Part): Part | undefined =>
    PARTS[PARTS.findIndex((p) => p.part === part) + 1]?.part;
  const previous = (part: Part): Part | undefined =>
    PARTS[PARTS.findIndex((p) => p.part === part) - 1]?.part;

  const setPart = (part: Part, raw: string, max: number) => {
    const digits = raw.replace(/\D/g, "").slice(0, max);
    onChange({ ...value, [part]: digits });
    if (digits.length === max) focus(next(part));
  };

  return (
    <Box>
      <Typography
        variant="caption"
        color="textSecondary"
        component="div"
        sx={{ fontSize: "0.6rem", lineHeight: 1.6 }}
      >
        {title}
      </Typography>
      <Box
        data-testid={`${testIdPrefix}-box`}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          padding: "5px 10px",
          borderRadius: "4px",
          border: "1px solid",
          borderColor: invalid ? "error.main" : "rgba(0, 0, 0, 0.23)",
          "&:focus-within": {
            borderColor: invalid ? "error.main" : "primary.main",
            boxShadow: (theme) =>
              `0 0 0 1px ${invalid ? theme.palette.error.main : theme.palette.primary.main}`,
          },
        }}
      >
        {PARTS.map(({ part, max, width, placeholder, label }, index) => (
          <React.Fragment key={part}>
            {index > 0 && (
              <Typography
                component="span"
                aria-hidden
                sx={{
                  color: "text.primary",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  px: 0.6,
                  userSelect: "none",
                }}
              >
                /
              </Typography>
            )}
            <InputBase
              value={value[part]}
              placeholder={placeholder}
              onChange={(event) => setPart(part, event.target.value, max)}
              onBlur={() => {
                // one digit in month or day: show it as two digits (3 -> 03)
                if (part !== "year" && value[part].length === 1) {
                  onChange({ ...value, [part]: value[part].padStart(2, "0") });
                }
              }}
              onKeyDown={(event) => {
                if (["/", "-", ".", " "].includes(event.key)) {
                  event.preventDefault();
                  if (value[part]) focus(next(part));
                } else if (event.key === "Backspace" && value[part] === "") {
                  focus(previous(part));
                }
              }}
              onPaste={(event) => {
                const match = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(
                  event.clipboardData.getData("text")
                );
                if (match) {
                  event.preventDefault();
                  onChange({
                    year: match[1],
                    month: match[2].padStart(2, "0"),
                    day: match[3].padStart(2, "0"),
                  });
                  focus("day");
                }
              }}
              inputRef={(element) => (refs.current[part] = element)}
              inputProps={{
                inputMode: "numeric",
                maxLength: max,
                "aria-label": `${title} ${label}`,
                "data-testid": `${testIdPrefix}-${part}`,
                style: { textAlign: "center", padding: 0, fontSize: "0.8rem" },
              }}
              sx={{ width }}
            />
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------- the filter: start box ~ end box

export type TransactionDateBoxesFilterProps = {
  filterDateRange: Function;
  dateRangeFilters: TransactionDateRangePayload;
  resetDateRange: Function;
};

/**
 * The date filter: a start box and an end box (year / month / day each).
 * It is applied a moment after the boxes make a valid range. A wrong entry changes nothing and says why.
 */
const TransactionDateBoxesFilter: React.FC<TransactionDateBoxesFilterProps> = ({
  filterDateRange,
  dateRangeFilters,
  resetDateRange,
}) => {
  // when the user comes back to this tab, the boxes show the filter that is still active
  const [start, setStart] = useState<DateBox>(dateIsoToBox(dateRangeFilters?.dateRangeStart));
  const [end, setEnd] = useState<DateBox>(dateIsoToBox(dateRangeFilters?.dateRangeEnd));
  const applied = useRef(
    Boolean(dateRangeFilters?.dateRangeStart || dateRangeFilters?.dateRangeEnd)
  );

  const result = buildDateRange(start, end);
  const error = !result.ok ? errorText(result.error, result.boxes) : "";
  const anyText = [start, end].some((box) => box.year || box.month || box.day);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!result.ok) return; // a wrong entry keeps what is applied; the message says why
      if (result.empty) {
        if (applied.current) {
          applied.current = false;
          resetDateRange();
        }
      } else {
        applied.current = true;
        filterDateRange({
          dateRangeStart: result.dateRangeStart,
          dateRangeEnd: result.dateRangeEnd,
        });
      }
    }, APPLY_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  return (
    <Box data-testid="transaction-list-filter-date">
      <Box display="flex" alignItems="flex-end" flexWrap="wrap" gap={0.8}>
        <DatePartsBox
          title="시작일"
          testIdPrefix="transaction-list-filter-date-start"
          value={start}
          onChange={setStart}
          invalid={!result.ok && result.boxes.includes("start")}
        />
        <Typography
          component="span"
          sx={{ fontWeight: 700, fontSize: "0.8rem", pb: 0.8 }}
          aria-hidden
        >
          ~
        </Typography>
        <DatePartsBox
          title="종료일"
          testIdPrefix="transaction-list-filter-date-end"
          value={end}
          onChange={setEnd}
          invalid={!result.ok && result.boxes.includes("end")}
        />
        {anyText && (
          <Button
            size="small"
            sx={{ fontSize: "0.7rem", minWidth: 0 }}
            data-testid="transaction-list-filter-date-clear-button"
            onClick={() => {
              setStart({ year: "", month: "", day: "" });
              setEnd({ year: "", month: "", day: "" });
            }}
          >
            초기화
          </Button>
        )}
      </Box>
      {error && (
        <FormHelperText error data-testid="transaction-list-filter-date-message">
          {error}
        </FormHelperText>
      )}
    </Box>
  );
};

export default TransactionDateBoxesFilter;
