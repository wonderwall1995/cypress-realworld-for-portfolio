import React, { useEffect, useState } from "react";
import { BANK_ACCOUNTS_CHANGED } from "../utils/bankAccountEvents";
import { styled } from "@mui/material/styles";
import { useActor } from "@xstate/react";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { Link as RouterLink, useRouteMatch } from "react-router-dom";
import { Alert, Grid, Button, Paper, Typography } from "@mui/material";

import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import { DataContext, DataEvents, DataSchema } from "../machines/dataMachine";
import BankAccountForm from "../components/BankAccountForm";
import BankAccountList from "../components/BankAccountList";
import { apiErrorText } from "../utils/apiErrors";
import { createBankAccountRequest, deleteBankAccountRequest } from "../utils/bankAccountApi";

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
const PREFIX = "BankAccountsContainer";

const classes = {
  paper: `${PREFIX}-paper`,
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  [`&.${classes.paper}`]: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
}));

const BankAccountsContainer: React.FC<Props> = ({ authService, bankAccountsService }) => {
  const match = useRouteMatch();

  const [authState] = useActor(authService);
  const [bankAccountsState, sendBankAccounts] = useActor(bankAccountsService);

  const currentUser = authState?.context.user;

  // Both wait for the server. The screen changes only after the server approved.
  const createBankAccount = async (payload: any): Promise<string | undefined> => {
    try {
      await createBankAccountRequest(payload);
      sendBankAccounts("FETCH");
      return undefined;
    } catch (error) {
      return apiErrorText(error, "계좌를 만들지 못했습니다.");
    }
  };

  const [deleteRefusal, setDeleteRefusal] = useState("");
  const deleteBankAccount = async ({ id }: { id: string }) => {
    setDeleteRefusal("");
    try {
      await deleteBankAccountRequest(id);
      sendBankAccounts("FETCH");
    } catch (error) {
      setDeleteRefusal(apiErrorText(error, "계좌를 삭제하지 못했습니다."));
    }
  };

  useEffect(() => {
    sendBankAccounts("FETCH");
    // the deposit pop-up in the sidebar says when an account's balance changed
    const refetch = () => sendBankAccounts("FETCH");
    window.addEventListener(BANK_ACCOUNTS_CHANGED, refetch);
    return () => window.removeEventListener(BANK_ACCOUNTS_CHANGED, refetch);
  }, [sendBankAccounts]);

  if (match.url === "/bankaccounts/new" && currentUser?.id) {
    return (
      <StyledPaper className={classes.paper}>
        <Typography component="h2" variant="h6" color="primary" gutterBottom>
          은행 계좌 만들기
        </Typography>
        <BankAccountForm userId={currentUser?.id} createBankAccount={createBankAccount} />
      </StyledPaper>
    );
  }

  return (
    <StyledPaper className={classes.paper}>
      <Grid container direction="row" justifyContent="space-between" alignItems="center">
        <Grid item>
          <Typography component="h2" variant="h6" color="primary" gutterBottom>
            은행 계좌
          </Typography>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            size="large"
            component={RouterLink}
            to="/bankaccounts/new"
            data-testid="bankaccount-new"
          >
            만들기
          </Button>
        </Grid>
      </Grid>
      {deleteRefusal && (
        <Alert
          severity="error"
          onClose={() => setDeleteRefusal("")}
          data-testid="bankaccount-notice"
          sx={{ marginBottom: 1 }}
        >
          {deleteRefusal}
        </Alert>
      )}
      <BankAccountList
        bankAccounts={bankAccountsState?.context.results!}
        deleteBankAccount={deleteBankAccount}
      />
    </StyledPaper>
  );
};
export default BankAccountsContainer;
