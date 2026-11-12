import React from "react";
import { Box, MenuItem, TextField } from "@mui/material";
import { formatAmount } from "@rwa/shared";

/** One choice in the list. `balance` is only known for the signed-in user's own accounts. */
export interface AccountChoice {
  id: string;
  bankName: string;
  /** last 4 digits of the account number */
  last4: string;
  balance?: number;
}

export const toChoice = (a: {
  id: string;
  bankName: string;
  accountNumber?: string;
  accountNumberLast4?: string;
  balance?: number;
}): AccountChoice => ({
  id: a.id,
  bankName: a.bankName,
  last4: a.accountNumberLast4 ?? (a.accountNumber ?? "").slice(-4),
  balance: a.balance,
});

interface Props {
  label: string;
  testId: string;
  accounts: AccountChoice[] | undefined;
  value: string;
  onChange: (id: string) => void;
  /** accounts that cannot be used get this text next to them and cannot be chosen */
  disabledReason?: (account: AccountChoice) => string | undefined;
  helperText?: string;
}

const cut = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/**
 * One row of the drop-down. Left 60%: bank name and the last 4 digits (cut with "..." when long).
 * Right 40%: "잔액 $500.00" (only for my own accounts; the other side's balance is never shown).
 * Without a balance the account information gets the whole row.
 */
const AccountRow: React.FC<{
  account: AccountChoice;
  testId: string;
  reason?: string;
}> = ({ account, testId, reason }) => {
  const hasBalance = account.balance !== undefined;
  return (
    <Box sx={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0, gap: 1 }}>
      <Box
        data-testid={`${testId}-info`}
        sx={{ flex: hasBalance ? "0 0 60%" : "1 1 auto", minWidth: 0, ...cut }}
      >
        {account.bankName} ····{account.last4}
        {reason && ` (${reason})`}
      </Box>
      {hasBalance && (
        <Box
          data-testid={`${testId}-balance`}
          sx={{ flex: "1 1 0", minWidth: 0, textAlign: "right", ...cut }}
        >
          잔액 {formatAmount(account.balance!)}
        </Box>
      )}
    </Box>
  );
};

/** Bank account drop-down (see AccountRow for what a row shows). */
const AccountSelect: React.FC<Props> = ({
  label,
  testId,
  accounts,
  value,
  onChange,
  disabledReason,
  helperText,
}) => (
  <TextField
    select
    fullWidth
    margin="dense"
    size="small"
    label={label}
    value={accounts ? value : ""}
    onChange={(e) => onChange(e.target.value)}
    disabled={!accounts || accounts.length === 0}
    helperText={
      accounts && accounts.length === 0 ? "사용할 수 있는 은행 계좌가 없습니다" : helperText
    }
    error={Boolean(accounts && accounts.length === 0)}
    inputProps={{ "data-testid": `${testId}-value` }}
    SelectProps={{
      SelectDisplayProps: { "data-testid": testId } as React.HTMLAttributes<HTMLDivElement>,
      renderValue: (selected) => {
        const account = accounts?.find((a) => a.id === selected);
        return account ? <AccountRow account={account} testId={`${testId}-shown`} /> : "";
      },
      MenuProps: { disablePortal: false },
    }}
  >
    {(accounts ?? []).map((a) => {
      const reason = disabledReason?.(a);
      return (
        <MenuItem
          key={a.id}
          value={a.id}
          disabled={Boolean(reason)}
          data-testid={`${testId}-${a.id}`}
          sx={{ minWidth: 0 }}
        >
          <AccountRow account={a} testId={`${testId}-${a.id}-row`} reason={reason} />
        </MenuItem>
      );
    })}
  </TextField>
);

export default AccountSelect;
