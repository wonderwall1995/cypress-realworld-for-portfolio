import React, { useState } from "react";
import { styled } from "@mui/material/styles";
import NumberFormat from "react-number-format";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object, number } from "yup";
import { Paper, Typography, Button, Grid, Container, Avatar, Box, TextField } from "@mui/material";
import { MAX_AMOUNT_DOLLARS, User } from "@rwa/shared";

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
  description: string().required("메모를 입력하세요"),
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
  const [transactionType, setTransactionType] = useState<string>();
  const initialValues: FormValues = {
    amount: "",
    description: "",
    senderId: sender.id,
    receiverId: receiver.id,
  };

  return (
    <StyledPaper className={classes.paper} elevation={0}>
      <Box display="flex" height={200} alignItems="center" justifyContent="center">
        <Grid container direction="column" justifyContent="flex-start" alignItems="center">
          <Grid item>
            <Avatar src={receiver.avatar} />
          </Grid>
          <Grid item>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              {receiver.lastName} {receiver.firstName}
              {transactionType}
            </Typography>
          </Grid>
        </Grid>
      </Box>
      <Container maxWidth="xs">
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          validateOnMount={true}
          onSubmit={(values, { setSubmitting }) => {
            setSubmitting(true);

            // reset transactionType
            setTransactionType(undefined);

            createTransaction({ transactionType, ...values });
            showSnackbar({
              severity: "success",
              message: "거래가 접수되었습니다!",
            });
          }}
        >
          {({ isValid, isSubmitting }) => (
            <Form className={classes.form} data-testid="transaction-create-form">
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
                    required
                    id={"transaction-create-description-input"}
                    type="text"
                    placeholder="메모를 입력하세요"
                    data-testid={"transaction-create-description-input"}
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
                    data-testid="transaction-create-submit-request"
                    disabled={!isValid || isSubmitting}
                    onClick={() => setTransactionType("request")}
                  >
                    요청
                  </Button>
                </Grid>
                <Grid item>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    className={classes.submit}
                    data-testid="transaction-create-submit-payment"
                    disabled={!isValid || isSubmitting}
                    onClick={() => setTransactionType("payment")}
                  >
                    결제
                  </Button>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Container>
    </StyledPaper>
  );
};

export default TransactionCreateStepTwo;
