/* istanbul ignore next */
import React, { useEffect } from "react";
import { styled } from "@mui/material/styles";
import { useActor, useMachine } from "@xstate/react";
import { CssBaseline } from "@mui/material";
// @ts-ignore
import { LoginCallback, SecureRoute, useOktaAuth, withOktaAuth } from "@okta/okta-react";
import { Route } from "react-router-dom";

import { snackbarMachine } from "../machines/snackbarMachine";
import { notificationsMachine } from "../machines/notificationsMachine";
import { authService } from "../machines/authMachine";
import AlertBar from "../components/AlertBar";
import { bankAccountsMachine } from "../machines/bankAccountsMachine";
import PrivateRoutesContainer from "./PrivateRoutesContainer";

const PREFIX = "appOkta";

const classes = {
  root: `${PREFIX}-root`,
};

const Root = styled("div")(({ theme }) => ({
  [`&.${classes.root}`]: {
    display: "flex",
  },
}));

// Expose authService on window for end-to-end tests
// @ts-ignore
window.authService = authService;

/* istanbul ignore next */
const AppOkta: React.FC = () => {
  const { authState: oktaAuthState, oktaAuth: oktaAuthService } = useOktaAuth();

  const [authState] = useActor(authService);
  const [, , notificationsService] = useMachine(notificationsMachine);

  const [, , snackbarService] = useMachine(snackbarMachine);

  const [, , bankAccountsService] = useMachine(bankAccountsMachine);

  useEffect(() => {
    if (oktaAuthState.isAuthenticated) {
      oktaAuthService.getUser().then((user: any) => {
        authService.send("OKTA", { user, token: oktaAuthState.accessToken });
      });
    }
  }, [oktaAuthState, oktaAuthService]);

  const isLoggedIn =
    authState.matches("authorized") ||
    authState.matches("refreshing") ||
    authState.matches("updating");

  return (
    <Root className={classes.root}>
      <CssBaseline />

      {isLoggedIn && (
        <PrivateRoutesContainer
          isLoggedIn={isLoggedIn}
          notificationsService={notificationsService}
          authService={authService}
          snackbarService={snackbarService}
          bankAccountsService={bankAccountsService}
        />
      )}
      {authState.matches("unauthorized") && (
        <>
          <Route path="/implicit/callback" component={LoginCallback} />
          <SecureRoute exact path="/" />
        </>
      )}

      <AlertBar snackbarService={snackbarService} />
    </Root>
  );
};

export default withOktaAuth(AppOkta);
