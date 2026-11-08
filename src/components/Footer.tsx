import React from "react";
import { Container, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Container maxWidth="sm" style={{ marginTop: 50 }}>
      <Typography variant="body2" color="textSecondary" align="center">
        Forked from the{" "}
        <a
          style={{ textDecoration: "none" }}
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/cypress-io/cypress-realworld-app"
        >
          Cypress Real World App
        </a>{" "}
        (MIT License)
      </Typography>
    </Container>
  );
}
