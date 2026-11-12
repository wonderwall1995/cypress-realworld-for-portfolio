import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";

interface Props {
  open: boolean;
  title: string;
  /** what is about to happen, in one or two short lines */
  summary: React.ReactNode;
  /** extra input shown between the summary and the password (for example an account choice) */
  extra?: React.ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  testIdPrefix: string;
  onClose: () => void;
  /**
   * Called with the password once the server says it is the member's own password.
   * Return a sentence when the real action was refused: it is shown here and the window stays open.
   */
  onConfirm: (password: string) => void | string | undefined | Promise<void | string | undefined>;
}

/**
 * Last step before money moves: "정말 진행하겠습니까? 자신의 계정 비밀번호를 입력해주세요."
 * The password is checked with the server first, so a wrong one is shown here and nothing is sent.
 */
const PasswordConfirmDialog: React.FC<Props> = ({
  open,
  title,
  summary,
  extra,
  confirmDisabled,
  confirmLabel,
  testIdPrefix,
  onClose,
  onConfirm,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setBusy(false);
    }
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await httpClient.post(`${API_BASE}/users/verifyPassword`, { password });
    } catch (e: any) {
      setError(
        e?.response?.status === 403
          ? "비밀번호가 맞지 않습니다"
          : "비밀번호를 확인하지 못했습니다. 잠시 뒤 다시 시도하세요"
      );
      setBusy(false);
      return;
    }
    // the password is right: now the real action, and its refusal (if any) is shown here
    const refusal = await onConfirm(password);
    if (refusal) setError(refusal);
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      data-testid={`${testIdPrefix}-dialog`}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" data-testid={`${testIdPrefix}-summary`}>
          {summary}
        </DialogContentText>
        {extra}
        <DialogContentText sx={{ marginTop: 2 }}>
          자신의 계정 비밀번호를 입력해주세요.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          size="small"
          type="password"
          label="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password && !busy) confirm();
          }}
          error={Boolean(error)}
          inputProps={{
            "data-testid": `${testIdPrefix}-password`,
            autoComplete: "current-password",
          }}
        />
        {error && (
          <Alert severity="error" sx={{ marginTop: 1 }} data-testid={`${testIdPrefix}-error`}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid={`${testIdPrefix}-cancel`}>
          취소
        </Button>
        <Button
          variant="contained"
          disabled={!password || busy || confirmDisabled}
          onClick={confirm}
          data-testid={`${testIdPrefix}-confirm`}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PasswordConfirmDialog;
