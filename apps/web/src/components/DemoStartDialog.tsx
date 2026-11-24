import React from "react";
import { DEMO_Z_INDEX } from "../demo/layout";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

interface Props {
  open: boolean;
  /** file name of the test that the viewer picked, for example 003-transfer.spec.ts */
  fileName: string;
  /** how many tests the whole demo has */
  total: number;
  onPartial: () => void;
  onAll: () => void;
  onClose: () => void;
}

/** Asked when the viewer starts the demo while one test is picked ("테스트 별 코드 확인"): only that test, or all. */
export default function DemoStartDialog({
  open,
  fileName,
  total,
  onPartial,
  onAll,
  onClose,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      sx={{ zIndex: DEMO_Z_INDEX + 3 }}
      data-testid="demo-start-dialog"
    >
      <DialogTitle>무엇을 실행할까요?</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <b data-testid="demo-start-dialog-file" style={{ fontFamily: "monospace" }}>
            {fileName}
          </b>
          를 골랐습니다. 이 코드만 실행하거나, 처음부터 전체 {total}개를 실행할 수 있습니다.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="demo-start-dialog-cancel">
          취소
        </Button>
        <Button variant="outlined" onClick={onAll} data-testid="demo-start-dialog-all">
          전체 실행
        </Button>
        <Button
          variant="contained"
          autoFocus
          onClick={onPartial}
          data-testid="demo-start-dialog-partial"
        >
          부분 실행
        </Button>
      </DialogActions>
    </Dialog>
  );
}
