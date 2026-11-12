import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  TextField,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { BankAccount, MAX_AMOUNT_DOLLARS, formatAmount, isValidAmountDollars } from "@rwa/shared";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";
import { apiErrorText } from "../utils/apiErrors";
import { BANK_ACCOUNTS_CHANGED } from "../utils/bankAccountEvents";

interface Props {
  open: boolean;
  onClose: () => void;
  /** called after the money is in the bank account */
  onDone?: () => void;
}

/**
 * Virtual deposit: pick one of my bank accounts, type whole dollars, the number goes into that account's balance.
 * No real bank is involved (POST /bankTransfers does the work).
 */
const DepositDialog: React.FC<Props> = ({ open, onClose, onDone }) => {
  const [accounts, setAccounts] = useState<BankAccount[] | undefined>();
  const [accountId, setAccountId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmountText("");
    setError("");
    setAccounts(undefined);
    httpClient
      .get(`${API_BASE}/bankAccounts`)
      .then((resp) => {
        const list: BankAccount[] = resp.data.results;
        setAccounts(list);
        setAccountId(list[0]?.id ?? "");
      })
      .catch(() => setError("은행 계좌를 불러오지 못했습니다"));
  }, [open]);

  const amount = Number(amountText);
  const amountOk = /^\d+$/.test(amountText) && isValidAmountDollars(amount);
  const amountError =
    amountText !== "" && !amountOk
      ? `1 이상 ${MAX_AMOUNT_DOLLARS.toLocaleString()} 이하의 정수(달러)를 입력하세요`
      : "";

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await httpClient.post(`${API_BASE}/bankTransfers`, {
        bankAccountId: accountId,
        amount,
        type: "deposit",
      });
      window.dispatchEvent(new Event(BANK_ACCOUNTS_CHANGED));
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(apiErrorText(e, "입금하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const noAccount = accounts !== undefined && accounts.length === 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" data-testid="deposit-dialog">
      <DialogTitle>입금</DialogTitle>
      <DialogContent>
        {noAccount ? (
          <Alert severity="info" data-testid="deposit-no-account">
            입금하려면 먼저 은행 계좌가 있어야 합니다.
          </Alert>
        ) : (
          <>
            <TextField
              select
              fullWidth
              margin="dense"
              label="입금할 은행 계좌"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={!accounts}
              inputProps={{ "data-testid": "deposit-account-select" }}
              SelectProps={{ MenuProps: { disablePortal: false } }}
            >
              {(accounts ?? []).map((a) => (
                <MenuItem key={a.id} value={a.id} data-testid={`deposit-account-${a.id}`}>
                  {a.bankName} · {a.accountNumber} · {formatAmount(a.balance ?? 0)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              margin="dense"
              label="입금 금액"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.trim())}
              error={Boolean(amountError)}
              helperText={amountError || " "}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              inputProps={{ inputMode: "numeric", "data-testid": "deposit-amount-input" }}
            />
          </>
        )}
        {error && (
          <Alert severity="error" data-testid="deposit-error" sx={{ marginTop: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="deposit-cancel-button">
          취소
        </Button>
        {noAccount ? (
          <Button
            variant="contained"
            component={RouterLink}
            to="/bankaccounts/new"
            onClick={onClose}
            data-testid="deposit-go-bankaccounts-button"
          >
            은행 계좌 만들기
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={!amountOk || !accountId || busy}
            onClick={submit}
            data-testid="deposit-submit-button"
          >
            입금
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DepositDialog;
