import React, { useEffect, useRef, useState } from "react";
import { Switch, useLocation } from "react-router";
import { Alert, Button, Snackbar } from "@mui/material";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import MainLayout from "../components/MainLayout";
import PrivateRoute from "../components/PrivateRoute";
import TransactionsContainer from "./TransactionsContainer";
import UserSettingsContainer from "./UserSettingsContainer";
import NotificationsContainer from "./NotificationsContainer";
import BankAccountsContainer from "./BankAccountsContainer";
import TransactionCreateContainer from "./TransactionCreateContainer";
import TransactionDetailContainer from "./TransactionDetailContainer";
import { DataContext, DataSchema, DataEvents } from "../machines/dataMachine";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import { SnackbarContext, SnackbarSchema, SnackbarEvents } from "../machines/snackbarMachine";
import { useActor } from "@xstate/react";
import { CurrentUserIdContext } from "../utils/currentUserContext";

export interface Props {
  isLoggedIn: boolean;
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
  notificationsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
  snackbarService: Interpreter<
    SnackbarContext,
    SnackbarSchema,
    SnackbarEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, SnackbarEvents, BaseActionObject, ServiceMap>
  >;
  bankAccountsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
}

const NOTIFICATION_REFRESH_MS = 10000;

const PrivateRoutesContainer: React.FC<Props> = ({
  isLoggedIn,
  authService,
  notificationsService,
  snackbarService,
  bankAccountsService,
}) => {
  const [notificationsState, sendNotifications] = useActor(notificationsService);
  const [authState] = useActor(authService);

  const location = useLocation();

  // Money sent to me makes a "received" notification (the bell already asks for new ones). When a new
  // one shows up, tell the member that the amounts changed. No extra requests to the server are needed.
  const seenReceived = useRef<Set<string> | null>(null);
  const [amountsChanged, setAmountsChanged] = useState(false);
  const notificationResults = notificationsState.context?.results as any[] | undefined;
  useEffect(() => {
    // before the first answer the list is only the empty starting value
    if (!notificationsState.matches("success") || !notificationResults) return;
    const received = notificationResults.filter((n) => n.status === "received");
    if (seenReceived.current === null) {
      seenReceived.current = new Set(received.map((n) => n.id)); // what was already there is not news
      return;
    }
    const fresh = received.filter((n) => !seenReceived.current!.has(n.id));
    if (fresh.length > 0) {
      fresh.forEach((n) => seenReceived.current!.add(n.id));
      setAmountsChanged(true);
    }
  }, [notificationResults, notificationsState]);

  // The number on the bell must follow new notifications: load them when the page
  // changes, and again every few seconds while this browser tab is visible.
  useEffect(() => {
    sendNotifications({ type: "FETCH" });
  }, [sendNotifications, location.pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        sendNotifications({ type: "FETCH" });
      }
    }, NOTIFICATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [sendNotifications]);

  return (
    <CurrentUserIdContext.Provider value={authState?.context?.user?.id}>
      <Snackbar
        open={amountsChanged}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") setAmountsChanged(false);
        }}
      >
        <Alert
          severity="info"
          data-testid="amounts-changed-notice"
          onClose={() => setAmountsChanged(false)}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
              data-testid="amounts-changed-reload"
            >
              새로고침
            </Button>
          }
        >
          금액 변동이 생겼어요. 새로고침을 해주세요.
        </Alert>
      </Snackbar>
      <MainLayout notificationsService={notificationsService} authService={authService}>
        <Switch>
          <PrivateRoute isLoggedIn={isLoggedIn} exact path={"/(public|contacts|personal)?"}>
            <TransactionsContainer />
          </PrivateRoute>
          <PrivateRoute isLoggedIn={isLoggedIn} exact path="/user/settings">
            <UserSettingsContainer authService={authService} />
          </PrivateRoute>
          <PrivateRoute isLoggedIn={isLoggedIn} exact path="/notifications">
            <NotificationsContainer
              authService={authService}
              notificationsService={notificationsService}
            />
          </PrivateRoute>
          <PrivateRoute isLoggedIn={isLoggedIn} path="/bankaccounts*">
            <BankAccountsContainer
              authService={authService}
              bankAccountsService={bankAccountsService}
            />
          </PrivateRoute>
          <PrivateRoute isLoggedIn={isLoggedIn} exact path="/transaction/new">
            <TransactionCreateContainer
              authService={authService}
              snackbarService={snackbarService}
            />
          </PrivateRoute>
          <PrivateRoute isLoggedIn={isLoggedIn} exact path="/transaction/:transactionId">
            <TransactionDetailContainer authService={authService} />
          </PrivateRoute>
        </Switch>
      </MainLayout>
    </CurrentUserIdContext.Provider>
  );
};

export default PrivateRoutesContainer;
