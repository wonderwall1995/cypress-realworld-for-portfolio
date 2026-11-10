import React from "react";
import { styled } from "@mui/material/styles";
import { useActor } from "@xstate/react";
import { Interpreter } from "xstate";
import { Link } from "react-router-dom";
import { Button, Container, CssBaseline, TextField, Grid, Box, Typography } from "@mui/material";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object, ref } from "yup";

import RWALogo from "./SvgRwaLogo";
import SourceCredit from "./SourceCredit";
import { PHONE_NUMBER_PATTERN, SignUpPayload } from "@rwa/shared";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";

const PREFIX = "SignUpForm";

const classes = {
  paper: `${PREFIX}-paper`,
  logo: `${PREFIX}-logo`,
  form: `${PREFIX}-form`,
  submit: `${PREFIX}-submit`,
};

const StyledContainer = styled(Container)(({ theme }) => ({
  [`& .${classes.paper}`]: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  [`& .${classes.logo}`]: {
    color: theme.palette.primary.main,
  },

  [`& .${classes.form}`]: {
    width: "100%", // Fix IE 11 issue.
    marginTop: theme.spacing(1),
  },

  [`& .${classes.submit}`]: {
    margin: theme.spacing(3, 0, 2),
  },
})) as typeof Container;

const validationSchema = object({
  firstName: string().required("이름을 입력하세요"),
  lastName: string().required("성을 입력하세요"),
  username: string().required("사용자 이름을 입력하세요"),
  password: string().min(4, "비밀번호는 4자 이상이어야 합니다").required("비밀번호를 입력하세요"),
  phoneNumber: string()
    .required("연락처를 입력하세요")
    .matches(PHONE_NUMBER_PATTERN, "올바른 연락처가 아닙니다 (예: 010-1234-5678)"),
  confirmPassword: string()
    .required("비밀번호를 한 번 더 입력하세요")
    .oneOf([ref("password")], "비밀번호가 일치하지 않습니다"),
});

export interface Props {
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
}

const SignUpForm: React.FC<Props> = ({ authService }) => {
  const [, sendAuth] = useActor(authService);
  const initialValues: SignUpPayload & { confirmPassword: string } = {
    firstName: "",
    lastName: "",
    username: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  };

  const signUpPending = (payload: SignUpPayload) => sendAuth({ type: "SIGNUP", ...payload });

  return (
    <StyledContainer component="main" maxWidth="xs">
      <CssBaseline />
      <div className={classes.paper}>
        <div>
          <RWALogo className={classes.logo} />
          <SourceCredit />
        </div>
        <Typography component="h1" variant="h5" data-testid="signup-title">
          회원가입
        </Typography>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { setSubmitting, setFieldValue }) => {
            setSubmitting(true);

            signUpPending(values);
          }}
        >
          {({ isValid, isSubmitting, dirty }) => (
            <Form className={classes.form}>
              <Field name="lastName">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    id="lastName"
                    label="성"
                    type="text"
                    autoFocus
                    data-testid="signup-last-name"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Field name="firstName">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    id="firstName"
                    label="이름"
                    type="text"
                    data-testid="signup-first-name"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Field name="username">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="사용자 이름"
                    type="text"
                    data-testid="signup-username"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Field name="phoneNumber">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    id="phoneNumber"
                    label="연락처"
                    type="text"
                    placeholder="데모 웹입니다. 진짜 연락처는 넣지 마세요!"
                    InputLabelProps={{ shrink: true }}
                    data-testid="signup-phone-number"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Field name="password">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    label="비밀번호 (4자 이상)"
                    type="password"
                    id="password"
                    data-testid="signup-password"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Field name="confirmPassword">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    label="비밀번호 확인"
                    id="confirmPassword"
                    data-testid="signup-confirmPassword"
                    type="password"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
                data-testid="signup-submit"
                disabled={!isValid || isSubmitting}
              >
                회원가입
              </Button>
              <Grid container>
                <Grid item>
                  <Link to="/signin">{"계정이 있으신가요? 로그인"}</Link>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </div>
      <Box mt={8}></Box>
    </StyledContainer>
  );
};

export default SignUpForm;
