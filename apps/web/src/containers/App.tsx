import React from "react";
import { styled } from "@mui/material/styles";
import { Switch, Route, Redirect } from "react-router-dom";
import { useActor, useMachine } from "@xstate/react";
import { Box, CssBaseline } from "@mui/material";

import { snackbarMachine } from "../machines/snackbarMachine";
import { notificationsMachine } from "../machines/notificationsMachine";
import { authService } from "../machines/authMachine";
import AlertBar from "../components/AlertBar";
import SignInForm from "../components/SignInForm";
import SignUpForm from "../components/SignUpForm";
import { bankAccountsMachine } from "../machines/bankAccountsMachine";
import PrivateRoutesContainer from "./PrivateRoutesContainer";
import DemoFooter from "../components/DemoFooter";
import DemoAccordion from "../components/DemoAccordion";
import { demoQueue } from "../demo/queue";
import { demoController, useDemo } from "../demo/controller";
import { buildPlan, currentTestIdAt } from "../demo/plan";
import DemoNotice from "../components/DemoNotice";

const PREFIX = "App";

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

const App: React.FC = () => {
  const [authState] = useActor(authService);
  const [, , notificationsService] = useMachine(notificationsMachine);

  const [, , snackbarService] = useMachine(snackbarMachine);

  const [, , bankAccountsService] = useMachine(bankAccountsMachine);

  // The test demo runs on this very app: the accordion opens at the right of the current screen
  const demo = useDemo();
  // the steps of the running test, read from its code: the footer shows the testid of the current step
  const demoPlan = React.useMemo(
    () => (demoQueue[demo.index] ? buildPlan(demoQueue[demo.index]) : []),
    [demo.index]
  );
  const currentTestId = currentTestIdAt(demoPlan, demo.state, demo.activeFile, demo.activeLine);

  const isLoggedIn =
    authState.matches("authorized") ||
    authState.matches("refreshing") ||
    authState.matches("updating");

  return (
    // A column of the whole window: the app (and the accordion) above, the demo footer below
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%", height: "100vh" }}>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* position: relative keeps the absolute top bar inside this area (not under the accordion) */}
        <Box sx={{ flex: 1, minWidth: 0, overflow: "auto", position: "relative" }}>
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
        <Switch>
          <Route exact path="/signup">
            <SignUpForm authService={authService} />
          </Route>
          <Route exact path="/signin">
            <SignInForm authService={authService} />
          </Route>
          <Route path="/*">
            <Redirect
              to={{
                pathname: "/signin",
              }}
            />
          </Route>
        </Switch>
      )}
      <AlertBar snackbarService={snackbarService} />
          </Root>
        </Box>
        {/* always on screen: it can be folded and unfolded at any time, also when no demo runs */}
        {demoQueue[demo.index] && (
          <DemoAccordion
            current={demoQueue[demo.index]}
            next={demoQueue[demo.index + 1]}
            state={demo.state}
            index={demo.index}
            activeFile={demo.activeFile}
            activeLine={demo.activeLine}
            error={demo.error}
            api={demo.api}
            apis={demo.apis}
          />
        )}
      </Box>
      <DemoNotice notice={demo.notice} />
      <DemoFooter
        state={demo.state}
        hasPrev={demo.index > 0}
        hasNext={demo.index < demoQueue.length - 1}
        currentTestId={currentTestId}
        progress={demo.state === "idle" ? undefined : { current: demo.index + 1, total: demoQueue.length }}
        onStart={demoController.start}
        onTogglePause={demoController.togglePause}
        onPrev={demoController.prev}
        onNext={demoController.next}
        onStop={demoController.stop}
      />
    </Box>
  );
};

export default App;
