import React from "react";
import { Alert, Snackbar } from "@mui/material";
import { DEMO_Z_INDEX, FOOTER_HEIGHT, MOBILE_FOOTER_SPACE } from "../demo/layout";

const SHOW_MS = 2000;

/**
 * A short toast at the bottom left, just above the demo footer.
 * It tells which code file the demo runs now, for example "signup.ts 코드를 실행합니다".
 */
export default function DemoNotice({ notice }: { notice?: { id: number; text: string } }) {
  const [shownId, setShownId] = React.useState<number | undefined>();

  // a new message (new id) opens the toast again
  React.useEffect(() => {
    setShownId(notice?.id);
  }, [notice?.id]);

  if (!notice) return null;
  return (
    <Snackbar
      key={notice.id}
      open={shownId === notice.id}
      autoHideDuration={SHOW_MS}
      onClose={(_event, reason) => {
        if (reason !== "clickaway") setShownId(undefined);
      }}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      // "&&" makes this rule stronger than the default position of the MUI snackbar
      sx={{
        zIndex: DEMO_Z_INDEX + 2,
        pointerEvents: "none",
        "&&": {
          bottom: { xs: `calc(${MOBILE_FOOTER_SPACE} + 60px)`, sm: FOOTER_HEIGHT + 12 },
          left: 16,
        },
      }}
      data-testid="demo-notice"
    >
      <Alert severity="info" variant="filled" icon={false} sx={{ py: 0.25 }}>
        {notice.text}
      </Alert>
    </Snackbar>
  );
}
