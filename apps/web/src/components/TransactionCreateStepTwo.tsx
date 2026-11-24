import React, { useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
import NumberFormat from "react-number-format";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object, number } from "yup";
import { Paper, Typography, Button, Grid, Container, Avatar, Box, TextField } from "@mui/material";
import { MAX_AMOUNT_DOLLARS, User, formatAmount } from "@rwa/shared";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";
import { apiErrorText } from "../utils/apiErrors";
import AccountSelect, { AccountChoice, toChoice } from "./AccountSelect";
import PasswordConfirmDialog from "./PasswordConfirmDialog";

const PREFIX = "TransactionCreateStepTwo";

const classes = {
  paper: `${PREFIX}-paper`,
  form: `${PREFIX}-form`,
  submit: `${PREFIX}-submit`,
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  [`&.${classes.paper}`]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  [`& .${classes.form}`]: {
    width: "100%",
    marginTop: theme.spacing(1),
  },

  [`& .${classes.submit}`]: {
    margin: theme.spacing(3, 0, 2),
  },
}));

const validationSchema = object({
  amount: number()
    .typeError("올바른 금액을 입력하세요")
    .required("올바른 금액을 입력하세요")
    .integer("금액은 소수점 없이 정수로 입력하세요")
    .min(1, "금액은 1달러 이상이어야 합니다")
    .max(MAX_AMOUNT_DOLLARS, `금액은 ${MAX_AMOUNT_DOLLARS.toLocaleString()}달러 이하여야 합니다`),
  description: string(), // the memo may stay empty
  senderId: string(),
  receiverId: string(),
});

interface NumberFormatCustomProps {
  inputRef: (el: HTMLInputElement) => void;
  onChange: (event: { target: { value: string } }) => void;
}

function NumberFormatCustom(props: NumberFormatCustomProps) {
  const { inputRef, onChange, ...other } = props;

  return (
    <NumberFormat
      {...other}
      getInputRef={inputRef}
      onValueChange={(values) => {
        onChange({
          target: {
            ...other,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      isNumericString
      allowNegative={false}
      prefix="$"
    />
  );
}

export interface TransactionCreateStepTwoProps {
  receiver: User;
  sender: User;
  createTransaction: Function;
  showSnackbar: Function;
}

interface FormValues {
  amount: number | "";
  description: string;
  senderId: string;
  receiverId: string;
}

const TransactionCreateStepTwo: React.FC<TransactionCreateStepTwoProps> = ({
  receiver,
  sender,
  createTransaction,
  showSnackbar,
}) => {
  const [myAccounts, setMyAccounts] = useState<AccountChoice[]>();
  const [otherAccounts, setOtherAccounts] = useState<AccountChoice[]>();
  const [myAccountId, setMyAccountId] = useState("");
  const [otherAccountId, setOtherAccountId] = useState("");
  const [pending, setPending] = useState<FormValues | undefined>();

  // my accounts (with balances) and the receiver's accounts (bank name + last 4 digits only)
  useEffect(() => {
    httpClient.get(`${API_BASE}/bankAccounts`).then((resp) => {
      const list = (resp.data.results as any[]).filter((a) => a.visible).map(toChoice);
      setMyAccounts(list);
      setMyAccountId(list[0]?.id ?? "");
    });
    httpClient.get(`${API_BASE}/bankAccounts/of-user/${receiver.id}`).then((resp) => {
      const list = (resp.data.results as any[]).map(toChoice);
      setOtherAccounts(list);
      setOtherAccountId(list[0]?.id ?? "");
    });
  }, [receiver.id]);

  const myAccount = myAccounts?.find((a) => a.id === myAccountId);
  const otherAccount = otherAccounts?.find((a) => a.id === otherAccountId);

  // The transfer is sent here and we WAIT for the server. Only an approved transfer moves on to the
  // "완료" step; a refusal comes back as a sentence and is shown in the confirm window.
  const send = async (values: FormValues, password?: string): Promise<string | undefined> => {
    try {
      const resp = await httpClient.post(`${API_BASE}/transactions`, {
        transactionType: "payment",
        ...values,
        myAccountId,
        otherAccountId,
        password,
      });
      setPending(undefined);
      // `result` tells the step machine the server already approved, so it does not send it again
      createTransaction({ transactionType: "payment", ...values, result: resp.data });
      showSnackbar({ severity: "success", message: "이체가 완료되었습니다!" });
      return undefined;
    } catch (error) {
      return apiErrorText(error, "이체하지 못했습니다.");
    }
  };

  const initialValues: FormValues = {
    amount: "",
    description: "",
    senderId: sender.id,
    receiverId: receiver.id,
  };

  // the chosen account of mine cannot cover the typed amount (a payment would be refused)
  const payNotEnough = (amount: number | "") =>
    Boolean(myAccount) &&
    myAccount!.balance !== undefined &&
    Number(amount) * 100 > myAccount!.balance!;

  return (
    <StyledPaper className={classes.paper} elevation={0}>
      <Container maxWidth="xs" sx={{ marginTop: 3 }}>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          validateOnMount={true}
          onSubmit={(values, { setSubmitting }) => {
            // money leaves my account: ask "are you sure?" and the password first
            setPending(values);
            setSubmitting(false);
          }}
        >
          {({ isValid, isSubmitting, values }) => (
            <Form className={classes.form} data-testid="transaction-create-form">
              {/* card 1: what I send (amount, memo, the account the money leaves) */}
              <Paper
                variant="outlined"
                sx={{ padding: 2 }}
                data-testid="transaction-create-send-card"
              >
                <Typography component="h2" variant="subtitle1" fontWeight={700} gutterBottom>
                  내가 보내는 이체
                </Typography>
                <Field name="amount">
                  {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                    <TextField
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      required
                      autoFocus
                      id={"transaction-create-amount-input"}
                      type="text"
                      placeholder="금액 (1달러 이상, 정수)"
                      data-testid={"transaction-create-amount-input"}
                      error={(touched || value !== initialValue) && Boolean(error)}
                      helperText={touched || value !== initialValue ? error : ""}
                      InputProps={{
                        inputComponent: NumberFormatCustom as any,
                        inputProps: { id: "amount" },
                      }}
                      {...field}
                    />
                  )}
                </Field>
                <Field name="description">
                  {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                    <TextField
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      id={"transaction-create-description-input"}
                      type="text"
                      placeholder="메모 (선택)"
                      data-testid={"transaction-create-description-input"}
                      error={(touched || value !== initialValue) && Boolean(error)}
                      helperText={touched || value !== initialValue ? error : ""}
                      {...field}
                    />
                  )}
                </Field>
                <AccountSelect
                  label="내 은행 계좌 (이체할 돈이 나가는 계좌)"
                  testId="transaction-create-my-account"
                  accounts={myAccounts}
                  value={myAccountId}
                  onChange={setMyAccountId}
                  neededCents={Number(values.amount) * 100}
                />
                {payNotEnough(values.amount) && (
                  <Typography
                    variant="caption"
                    color="error"
                    component="p"
                    data-testid="transaction-create-not-enough"
                  >
                    선택한 계좌의 잔액({formatAmount(myAccount!.balance ?? 0)})이 부족합니다
                  </Typography>
                )}
              </Paper>
              {/* card 2: what the other person will receive (who, into which account) */}
              <Paper
                variant="outlined"
                sx={{ padding: 2, marginTop: 2 }}
                data-testid="transaction-create-receive-card"
              >
                <Typography component="h2" variant="subtitle1" fontWeight={700} gutterBottom>
                  상대가 받게 될 정보
                </Typography>
                <Box display="flex" alignItems="center" gap={1.5} marginBottom={1}>
                  <Avatar src={receiver.avatar} />
                  <Typography
                    variant="h6"
                    color="primary"
                    data-testid="transaction-create-receiver-name"
                  >
                    {receiver.lastName} {receiver.firstName}
                  </Typography>
                </Box>
                <AccountSelect
                  label="받는 계좌 (이체한 돈이 들어가는 계좌)"
                  testId="transaction-create-other-account"
                  accounts={otherAccounts}
                  value={otherAccountId}
                  onChange={setOtherAccountId}
                />
              </Paper>
              <Grid
                container
                spacing={2}
                direction="row"
                justifyContent="center"
                alignItems="center"
              >
                <Grid item>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    className={classes.submit}
                    data-testid="transaction-create-submit-payment"
                    disabled={
                      !isValid ||
                      isSubmitting ||
                      !myAccountId ||
                      !otherAccountId ||
                      payNotEnough(values.amount)
                    }
                  >
                    이체
                  </Button>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Container>
      <PasswordConfirmDialog
        open={Boolean(pending)}
        title="정말 이체하겠습니까?"
        confirmLabel="이체"
        testIdPrefix="transaction-confirm"
        onClose={() => setPending(undefined)}
        onConfirm={(password) => send(pending!, password)}
        summary={
          pending && (
            <>
              <div data-testid="transaction-confirm-from">
                {myAccount?.bankName} ····{myAccount?.last4}
              </div>
              <div aria-hidden>↓</div>
              <div data-testid="transaction-confirm-to">
                {receiver.lastName} {receiver.firstName}님 {otherAccount?.bankName} ····
                {otherAccount?.last4}
              </div>
              <Box
                component="b"
                data-testid="transaction-confirm-amount"
                sx={{ fontSize: "calc(1em + 3px)" }}
              >
                {formatAmount(Number(pending.amount) * 100)}
              </Box>
            </>
          )
        }
      />
    </StyledPaper>
  );
};

export default TransactionCreateStepTwo;
