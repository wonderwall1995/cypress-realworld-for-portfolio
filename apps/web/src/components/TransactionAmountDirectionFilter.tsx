import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Drawer,
  FormHelperText,
  InputAdornment,
  Popover,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { ArrowDropDown as ArrowDropDownIcon, Cancel as CancelIcon } from "@mui/icons-material";
import {
  DollarRangeError,
  MAX_AMOUNT_DOLLARS,
  TransactionAmountFilterPayload,
  centsToDollarText,
  parseDollarRange,
} from "@rwa/shared";

type Kind = "deposit" | "withdrawal";

const KINDS: Record<Kind, { title: string; meaning: string; minKey: string; maxKey: string }> = {
  deposit: {
    title: "입금 금액",
    meaning: "내가 받은 돈",
    minKey: "depositMin",
    maxKey: "depositMax",
  },
  withdrawal: {
    title: "출금 금액",
    meaning: "내가 보낸 돈",
    minKey: "withdrawalMin",
    maxKey: "withdrawalMax",
  },
};

const ERROR_TEXT: Record<DollarRangeError, string> = {
  format: "숫자(정수)만 입력하세요",
  "too-large": `${MAX_AMOUNT_DOLLARS.toLocaleString()} 이하로 입력하세요`,
  order: "최소 금액이 최대 금액보다 클 수 없습니다",
};

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

// what the chip says about the amount filter that is applied
const rangeLabel = (min?: number, max?: number) => {
  if (min === undefined && max === undefined) return "전체";
  if (max === undefined) return `${dollars(min ?? 0)} 이상`;
  if ((min ?? 0) === max) return dollars(max); // the same number twice: exactly this amount
  return `${dollars(min ?? 0)} ~ ${dollars(max)}`;
};

// ---------------------------------------------------------------- one chip + its pop-up

type AmountChipProps = {
  kind: Kind;
  appliedMin?: number;
  appliedMax?: number;
  onApply: (minCents: number, maxCents?: number) => void;
  onClear: () => void;
};

const smallField = {
  "& input": { fontSize: "0.8rem", padding: "6px 8px" },
  "& .MuiInputAdornment-root p": { fontSize: "0.8rem" },
};

/**
 * "입금 금액: 전체" chip. Click it to open the pop-up (a bottom sheet on a phone):
 * minimum and maximum in whole dollars, then 적용 (apply) or 초기화 (reset).
 * While a filter is applied the chip shows it, and its (x) removes it.
 */
const AmountChip: React.FC<AmountChipProps> = ({
  kind,
  appliedMin,
  appliedMax,
  onApply,
  onClear,
}) => {
  const theme = useTheme();
  const xsBreakpoint = useMediaQuery(theme.breakpoints.only("xs"));
  const { title, meaning } = KINDS[kind];
  const prefix = `transaction-list-filter-${kind}`;

  const active = appliedMin !== undefined || appliedMax !== undefined;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");

  const open = (event: React.MouseEvent<HTMLElement>) => {
    // the pop-up always starts from what is applied now
    setMinText(centsToDollarText(appliedMin, true));
    setMaxText(centsToDollarText(appliedMax));
    setAnchor(event.currentTarget);
  };
  const close = () => setAnchor(null);

  const parsed = parseDollarRange(minText, maxText);
  const error = !parsed.ok ? ERROR_TEXT[parsed.error] : "";

  const apply = () => {
    if (!parsed.ok) return;
    if (parsed.empty) onClear();
    else onApply(parsed.minCents, parsed.maxCents);
    close();
  };

  const reset = () => {
    setMinText("");
    setMaxText("");
    onClear();
    close();
  };

  const content = (
    <Box sx={{ padding: 2, width: xsBreakpoint ? "auto" : 270 }} data-testid={prefix}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {title} <span style={{ fontWeight: 400 }}>({meaning})</span>
      </Typography>
      <Box display="flex" alignItems="center" gap={1} sx={{ marginTop: 1.5 }}>
        <TextField
          size="small"
          variant="outlined"
          value={minText}
          onChange={(event) => setMinText(event.target.value)}
          placeholder="0"
          error={Boolean(error)}
          sx={{ width: 96, ...smallField }}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          inputProps={{
            inputMode: "numeric",
            "aria-label": `${title} 최소`,
            "data-testid": `${prefix}-min`,
          }}
        />
        <span>~</span>
        <TextField
          size="small"
          variant="outlined"
          value={maxText}
          onChange={(event) => setMaxText(event.target.value)}
          placeholder="제한 없음"
          error={Boolean(error)}
          sx={{ width: 112, ...smallField }}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          inputProps={{
            inputMode: "numeric",
            "aria-label": `${title} 최대`,
            "data-testid": `${prefix}-max`,
          }}
        />
      </Box>
      <FormHelperText
        error={Boolean(error)}
        data-testid={`${prefix}-message`}
        sx={{ minHeight: 18 }}
      >
        {error || " "}
      </FormHelperText>
      <Typography
        variant="caption"
        color="textSecondary"
        component="div"
        sx={{ marginBottom: 1.5 }}
      >
        입금과 출금을 둘 다 켜면, 둘 중 하나에 맞는 거래가 보입니다.
      </Typography>
      <Box display="flex" justifyContent="space-between">
        <Button size="small" onClick={reset} data-testid={`${prefix}-reset-button`}>
          초기화
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!parsed.ok}
          onClick={apply}
          data-testid={`${prefix}-apply-button`}
        >
          적용
        </Button>
      </Box>
    </Box>
  );

  return (
    <>
      <Chip
        color="primary"
        variant={active ? "filled" : "outlined"}
        onClick={open}
        data-testid={`${prefix}-button`}
        label={`${title}: ${rangeLabel(appliedMin, appliedMax)}`}
        sx={{ height: 26, fontSize: "0.7rem" }}
        deleteIcon={
          active ? <CancelIcon data-testid={`${prefix}-clear-button`} /> : <ArrowDropDownIcon />
        }
        onDelete={active ? onClear : open}
      />
      {!xsBreakpoint && (
        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
        >
          {content}
        </Popover>
      )}
      {xsBreakpoint && (
        <Drawer anchor="bottom" open={Boolean(anchor)} ModalProps={{ onClose: close }}>
          <Button onClick={close} data-testid={`${prefix}-close-button`}>
            닫기
          </Button>
          {content}
        </Drawer>
      )}
    </>
  );
};

// ---------------------------------------------------------------- the two chips

export type TransactionAmountDirectionFilterProps = {
  filterAmountRange: Function;
  amountRangeFilters: TransactionAmountFilterPayload;
  resetAmountRange: Function;
};

/**
 * Two amount filters, always seen from the signed-in user:
 *   입금 금액 = money I received, 출금 금액 = money I paid.
 * They can both be on at the same time: a transaction then passes if either one matches.
 */
const TransactionAmountDirectionFilter: React.FC<TransactionAmountDirectionFilterProps> = ({
  filterAmountRange,
  amountRangeFilters,
  resetAmountRange,
}) => {
  const applied = (amountRangeFilters || {}) as Record<string, number | undefined>;

  // change one kind, keep the other kind as it is
  const change = (kind: Kind, minCents?: number, maxCents?: number) => {
    const { minKey, maxKey } = KINDS[kind];
    const next: Record<string, number | undefined> = {
      ...applied,
      [minKey]: minCents,
      [maxKey]: maxCents,
    };
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) resetAmountRange();
    else filterAmountRange(clean);
  };

  return (
    <Box display="flex" alignItems="center" gap={1} data-testid="transaction-list-filter-amount">
      {(Object.keys(KINDS) as Kind[]).map((kind) => (
        <AmountChip
          key={kind}
          kind={kind}
          appliedMin={applied[KINDS[kind].minKey]}
          appliedMax={applied[KINDS[kind].maxKey]}
          onApply={(min, max) => change(kind, min, max)}
          onClear={() => change(kind, undefined, undefined)}
        />
      ))}
    </Box>
  );
};

export default TransactionAmountDirectionFilter;
