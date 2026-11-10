import React from "react";
import { styled } from "@mui/material/styles";
import { Alert, TextField, Button, Grid, Typography } from "@mui/material";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object } from "yup";
import { ACCOUNT_NUMBER_PATTERN, BankAccountPayload, User } from "@rwa/shared";
import { useHistory } from "react-router";

const validationSchema = object({
  bankName: string().required("은행 이름을 입력하세요"),
  accountNumber: string()
    .required("계좌 번호를 입력하세요")
    .matches(ACCOUNT_NUMBER_PATTERN, "계좌 번호는 숫자 9~12자리여야 합니다"),
});

const PREFIX = "BankAccountForm";

const classes = {
  paper: `${PREFIX}-paper`,
  form: `${PREFIX}-form`,
  submit: `${PREFIX}-submit`,
};

const StyledFormik = styled(Formik)(({ theme }) => ({
  [`& .${classes.paper}`]: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  [`& .${classes.form}`]: {
    width: "100%", // Fix IE 11 issue.
    marginTop: theme.spacing(1),
  },

  [`& .${classes.submit}`]: {
    margin: theme.spacing(3, 0, 2),
  },
}));

export interface BankAccountFormProps {
  userId: User["id"];
  createBankAccount: Function;
  onboarding?: boolean;
}

const BankAccountForm: React.FC<BankAccountFormProps> = ({
  userId,
  createBankAccount,
  onboarding,
}) => {
  const history = useHistory();

  const initialValues: BankAccountPayload = {
    userId,
    bankName: "",
    accountNumber: "",
  };

  return (
    <StyledFormik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values, { setSubmitting }) => {
        setSubmitting(true);

        createBankAccount({ ...values, userId });

        if (!onboarding) {
          history.push("/bankaccounts");
        }
      }}
    >
      {({ isValid, isSubmitting }) => (
        <Form className={classes.form} data-testid="bankaccount-form">
          <Alert severity="warning" data-testid="bankaccount-demo-warning">
            진짜 자신의 계좌를 만들진 말아주세요! 이건 데모 웹입니다.
          </Alert>
          <Typography
            variant="caption"
            color="textSecondary"
            component="p"
            data-testid="bankaccount-number-guide"
            style={{ marginTop: 8 }}
          >
            계좌 번호는 9~12자리 숫자입니다. 데모라서 임의의 숫자를 입력해도 됩니다.
          </Typography>
          <Field name="bankName">
            {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
              <TextField
                variant="outlined"
                margin="dense"
                fullWidth
                required
                id={"bankaccount-bankName-input"}
                type="text"
                placeholder="은행 이름"
                data-testid={"bankaccount-bankName-input"}
                error={(touched || value !== initialValue) && Boolean(error)}
                helperText={touched || value !== initialValue ? error : ""}
                {...field}
              />
            )}
          </Field>
          <Field name="accountNumber">
            {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
              <TextField
                variant="outlined"
                margin="dense"
                fullWidth
                required
                id={"bankaccount-accountNumber-input"}
                type="text"
                placeholder="계좌 번호 (숫자 9~12자리)"
                data-testid={"bankaccount-accountNumber-input"}
                error={(touched || value !== initialValue) && Boolean(error)}
                helperText={touched || value !== initialValue ? error : ""}
                {...field}
              />
            )}
          </Field>
          <Grid
            container
            spacing={2}
            direction="row"
            justifyContent="flex-start"
            alignItems="flex-start"
          >
            <Grid item>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
                data-testid="bankaccount-submit"
                disabled={!isValid || isSubmitting}
              >
                저장
              </Button>
            </Grid>
          </Grid>
        </Form>
      )}
    </StyledFormik>
  );
};

export default BankAccountForm;
