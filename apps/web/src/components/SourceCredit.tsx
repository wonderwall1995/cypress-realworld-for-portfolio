import React from "react";
import { Typography } from "@mui/material";

/**
 * "Original project" line required by the MIT license notice of this fork.
 * It sits right under the "Real World App" logo. `light` is for the blue header (white text).
 */
export default function SourceCredit({ light }: { light?: boolean }) {
  return (
    <Typography
      variant="caption"
      component="div"
      align="center"
      data-testid="source-credit"
      style={{ color: light ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.6)", lineHeight: 1.4 }}
    >
      원본:{" "}
      <a
        data-testid="source-credit-link"
        style={{ color: "inherit", textDecoration: "underline" }}
        target="_blank"
        rel="noopener noreferrer"
        href="https://github.com/cypress-io/cypress-realworld-app"
      >
        Cypress Real World App
      </a>{" "}
      (MIT License)
    </Typography>
  );
}
