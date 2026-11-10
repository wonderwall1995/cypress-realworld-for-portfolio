import React from "react";
import { styled } from "@mui/material/styles";
import { TextField, Button, Grid } from "@mui/material";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object, mixed } from "yup";
import { User, DefaultPrivacyLevel, UserSettingsPayload, PHONE_NUMBER_PATTERN } from "@rwa/shared";

const PREFIX = "UserSettingsForm";

const classes = {
  paper: `${PREFIX}-paper`,
  form: `${PREFIX}-form`,
};

const StyledFormik = styled(Formik)(({ theme }) => ({
  [`& .${classes.paper}`]: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

const MarginHonoringDiv = styled("div")(({ theme }) => ({
  width: "100%", // Fix IE 11 issue.
  marginTop: theme.spacing(1),
}));

const DefaultPrivacyLevelValues = Object.values(DefaultPrivacyLevel);

const validationSchema = object({
  firstName: string().required("이름을 입력하세요"),
  lastName: string().required("성을 입력하세요"),
  email: string().email("올바른 이메일 주소가 아닙니다").required("이메일 주소를 입력하세요"),
  phoneNumber: string()
    .matches(PHONE_NUMBER_PATTERN, "올바른 전화번호가 아닙니다 (예: 010-1234-5678)")
    .required("전화번호를 입력하세요"),
  defaultPrivacyLevel: mixed<DefaultPrivacyLevel>().oneOf(DefaultPrivacyLevelValues),
});

export interface UserSettingsProps {
  userProfile: User;
  updateUser: Function;
}

const UserSettingsForm: React.FC<UserSettingsProps> = ({ userProfile, updateUser }) => {
  const initialValues: UserSettingsPayload = {
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    email: userProfile.email,
    phoneNumber: userProfile.phoneNumber,
    defaultPrivacyLevel: userProfile.defaultPrivacyLevel,
  };

  return (
    <StyledFormik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values, { setSubmitting }) => {
        setSubmitting(true);
        updateUser({ id: userProfile.id, ...values });
        setSubmitting(false);
      }}
    >
      {({ isValid, isSubmitting }) => (
        <MarginHonoringDiv>
          <Form data-testid="user-settings-form">
            <Field name="firstName">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-firstName-input"}
                  type="text"
                  placeholder="이름"
                  inputProps={{ "data-testid": "user-settings-firstName-input" }}
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
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-lastName-input"}
                  type="text"
                  placeholder="성"
                  inputProps={{ "data-testid": "user-settings-lastName-input" }}
                  error={(touched || value !== initialValue) && Boolean(error)}
                  helperText={touched || value !== initialValue ? error : ""}
                  {...field}
                />
              )}
            </Field>
            <Field name="email">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-email-input"}
                  type="text"
                  placeholder="이메일"
                  inputProps={{ "data-testid": "user-settings-email-input" }}
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
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-phoneNumber-input"}
                  type="text"
                  placeholder="전화번호 (예: 010-1234-5678)"
                  inputProps={{ "data-testid": "user-settings-phoneNumber-input" }}
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
                  sx={{ marginTop: 3, marginLeft: 0, marginBottom: 2 }}
                  data-testid="user-settings-submit"
                  disabled={!isValid || isSubmitting}
                >
                  저장
                </Button>
              </Grid>
            </Grid>
          </Form>
        </MarginHonoringDiv>
      )}
    </StyledFormik>
  );
};

export default UserSettingsForm;
