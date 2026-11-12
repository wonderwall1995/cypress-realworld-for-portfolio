import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "react-router-dom";
import { createTheme, StyledEngineProvider } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import App from "./containers/App";
import { history } from "./utils/historyUtils";

const INPUT_PADDING = "10px 14px";

const theme = createTheme({
  palette: {
    secondary: {
      main: "#fff",
    },
  },
  typography: {
    // htmlFontSize: 18.285714285714286,
    fontSize: 14 * 0.875,
    body1: {
      lineHeight: 1.43,
      letterSpacing: "0.01071em",
    },
  },
  components: {
    // One rule for the text inside EVERY text box (sign in, sign up, settings, transfer, bank account...):
    // a left/right space so the text and the placeholder do not touch the border, and an even
    // space above and below. The font size is not changed here.
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          padding: INPUT_PADDING,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          padding: INPUT_PADDING,
        },
      },
    },
    // A label that sits INSIDE the box (sign in, sign up) is centred for the box height above:
    // without this it sits a few pixels too low. Once it floats up it is on the border as usual.
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          transform: "translate(14px, 10px) scale(1)",
          "&.MuiInputLabel-shrink": {
            transform: "translate(14px, -9px) scale(0.75)",
          },
        },
      },
    },
    // MuiInput: {
    //   defaultProps: {
    //     inputProps: {
    //       backgroundColor: "green",
    //       height: "300px",
    //     },
    //   },
    // },
  },
});

const root = createRoot(document.getElementById("root")!);

root.render(
  <Router history={history}>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </StyledEngineProvider>
  </Router>
);
