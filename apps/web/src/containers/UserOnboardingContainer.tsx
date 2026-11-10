import React, { useEffect } from "react";
import {
  Button,
  Box,
  useTheme,
  useMediaQuery,
  Grid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { isEmpty } from "lodash/fp";
import { useActor, useMachine } from "@xstate/react";

import { userOnboardingMachine } from "../machines/userOnboardingMachine";
import BankAccountForm from "../components/BankAccountForm";
import { DataContext, DataEvents, DataSchema } from "../machines/dataMachine";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import NavigatorIllustration from "../components/SvgUndrawNavigatorA479";
import PersonalFinance from "../components/SvgUndrawPersonalFinanceTqcd";

export interface Props {
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
  bankAccountsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
}

const UserOnboardingContainer: React.FC<Props> = ({ authService, bankAccountsService }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [bankAccountsState, sendBankAccounts] = useActor(bankAccountsService);
  const [authState, sendAuth] = useActor(authService);
  const [userOnboardingState, sendUserOnboarding] = useMachine(userOnboardingMachine);

  const currentUser = authState?.context?.user;

  useEffect(() => {
    sendBankAccounts("FETCH");
  }, [sendBankAccounts]);

  const noBankAccounts =
    bankAccountsState?.matches("success.withoutData") &&
    isEmpty(bankAccountsState?.context?.results);

  const dialogIsOpen =
    (userOnboardingState.matches("stepTwo") && !noBankAccounts) ||
    (userOnboardingState.matches("stepThree") && !noBankAccounts) ||
    (!userOnboardingState.matches("done") && noBankAccounts) ||
    false;

  const nextStep = () => sendUserOnboarding("NEXT");

  const createBankAccountWithNextStep = (payload: any) => {
    sendBankAccounts({ type: "CREATE", ...payload });
    nextStep();
  };

  return (
    <Dialog data-testid="user-onboarding-dialog" fullScreen={fullScreen} open={dialogIsOpen}>
      <DialogTitle data-testid="user-onboarding-dialog-title">
        {userOnboardingState.matches("stepOne") && "Real World App 시작하기"}
        {userOnboardingState.matches("stepTwo") && "은행 계좌 만들기"}
        {userOnboardingState.matches("stepThree") && "완료"}
      </DialogTitle>
      <DialogContent data-testid="user-onboarding-dialog-content">
        <Box display="flex" alignItems="center" justifyContent="center">
          {userOnboardingState.matches("stepOne") && (
            <>
              <NavigatorIllustration />
              <br />
              <DialogContentText style={{ paddingLeft: 20 }}>
                거래를 하려면 은행 계좌가 필요합니다.
                <br />
                <br />
                <b>다음</b>을 눌러 은행 계좌 설정을 시작하세요.
              </DialogContentText>
            </>
          )}
          {userOnboardingState.matches("stepTwo") && (
            <BankAccountForm
              userId={currentUser?.id!}
              createBankAccount={createBankAccountWithNextStep}
              onboarding
            />
          )}
          {userOnboardingState.matches("stepThree") && (
            <>
              <PersonalFinance />
              <br />
              <DialogContentText style={{ paddingLeft: 20 }}>
                준비가 끝났습니다!
                <br />
                <br />
                Real World App에 오신 것을 환영합니다!
              </DialogContentText>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Grid container justifyContent="space-between">
          <Grid item>
            <Button
              style={{ paddingRight: "80%" }}
              onClick={/* istanbul ignore next */ () => sendAuth("LOGOUT")}
              color="secondary"
              data-testid="user-onboarding-logout"
            >
              로그아웃
            </Button>
          </Grid>
          <Grid item>
            {!userOnboardingState.matches("stepTwo") && (
              <Button onClick={() => nextStep()} color="primary" data-testid="user-onboarding-next">
                {userOnboardingState.matches("stepThree") ? "완료" : "다음"}
              </Button>
            )}
          </Grid>
        </Grid>
      </DialogActions>
    </Dialog>
  );
};

export default UserOnboardingContainer;
