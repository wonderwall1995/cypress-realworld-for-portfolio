import React from "react";
import { styled } from "@mui/material/styles";
import { useActor } from "@xstate/react";
import { Interpreter } from "xstate";
import { Link } from "react-router-dom";
import { Button, Container, CssBaseline, TextField, Grid, Box, Typography } from "@mui/material";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object, ref } from "yup";

import RWALogo from "./SvgRwaLogo";
import Footer from "./Footer";
import { SignUpPayload } from "@rwa/shared";
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
  firstName: string().required("First Name is required"),
  lastName: string().required("Last Name is required"),
  username: string().required("Username is required"),
  password: string()
    .min(4, "Password must contain at least 4 characters")
    .required("Enter your password"),
  confirmPassword: string()
    .required("Confirm your password")
    .oneOf([ref("password")], "Password does not match"),
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
        </div>
        <Typography component="h1" variant="h5" data-testid="signup-title">
          Sign Up
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
              <Field name="firstName">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    id="firstName"
                    label="First Name"
                    type="text"
                    autoFocus
                    data-testid="signup-first-name"
                    error={(touched || value !== initialValue) && Boolean(error)}
                    helperText={touched || value !== initialValue ? error : ""}
                    {...field}
                  />
                )}
              </Field>
              <Field name="lastName">
                {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                  <TextField
                    variant="outlined"
                    margin="normal"
                    required
                    fullWidth
                    id="lastName"
                    label="Last Name"
                    type="text"
                    data-testid="signup-last-name"
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
                    label="Username"
                    type="text"
                    data-testid="signup-username"
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
                    label="Password"
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
                    label="Confirm Password"
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
                Sign Up
              </Button>
              <Grid container>
                <Grid item>
                  <Link to="/signin">{"Have an account? Sign In"}</Link>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </div>
      <Box mt={8}>
        <Footer />
      </Box>
    </StyledContainer>
  );
};

export default SignUpForm;
