import React, { useEffect } from "react";
import { Switch, useLocation } from "react-router";
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
import UserOnboardingContainer from "./UserOnboardingContainer";
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
  const [, sendNotifications] = useActor(notificationsService);
  const [authState] = useActor(authService);

  const location = useLocation();

  // The number on the bell must follow new notifications: load them when the page
  // changes, and again every few seconds while this browser tab is visible.
  useEffect(() => {
    sendNotifications({ type: "FETCH" });
  }, [sendNotifications, location.pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") sendNotifications({ type: "FETCH" });
    }, NOTIFICATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [sendNotifications]);

  return (
    <CurrentUserIdContext.Provider value={authState?.context?.user?.id}>
      <MainLayout notificationsService={notificationsService} authService={authService}>
        <UserOnboardingContainer
          authService={authService}
          bankAccountsService={bankAccountsService}
        />
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
