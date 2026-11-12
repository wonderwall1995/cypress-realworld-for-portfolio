import React from "react";
import { styled } from "@mui/material/styles";
import { TextField, Button, Grid, Typography } from "@mui/material";
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
  // e-mail and phone number may be left empty
  email: string().email("올바른 이메일 주소가 아닙니다"),
  phoneNumber: string().matches(PHONE_NUMBER_PATTERN, {
    message: "올바른 전화번호가 아닙니다 (예: 010-1234-5678)",
    excludeEmptyString: true,
  }),
  defaultPrivacyLevel: mixed<DefaultPrivacyLevel>().oneOf(DefaultPrivacyLevelValues),
});

export interface SaveMessage {
  kind: "success" | "error";
  text: string;
}

export interface UserSettingsProps {
  userProfile: User;
  /** returns when the server has answered (it does not throw) */
  updateUser: (payload: any) => Promise<void> | void;
  /** result of the last save, shown above the save button */
  saveMessage?: SaveMessage;
  /** called when the member edits a field again (the old result is no longer true) */
  onEdit?: () => void;
}

const UserSettingsForm: React.FC<UserSettingsProps> = ({
  userProfile,
  updateUser,
  saveMessage,
  onEdit,
}) => {
  const initialValues: UserSettingsPayload = {
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    email: userProfile.email ?? "",
    phoneNumber: userProfile.phoneNumber ?? "",
    defaultPrivacyLevel: userProfile.defaultPrivacyLevel,
  };

  return (
    <StyledFormik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true);
        await updateUser({ id: userProfile.id, ...values });
        setSubmitting(false);
      }}
    >
      {({ isValid, isSubmitting }) => (
        <MarginHonoringDiv>
          <Form data-testid="user-settings-form" onInput={() => onEdit?.()}>
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
            <Field name="email">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
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
            {/* this space is always kept, so the page does not jump when a result appears */}
            <Typography
              variant="caption"
              component="div"
              role="status"
              data-testid="user-settings-message"
              data-kind={saveMessage?.kind ?? "none"}
              sx={{
                minHeight: 20,
                marginTop: 1,
                fontWeight: 600,
                color: saveMessage?.kind === "error" ? "error.main" : "success.main",
              }}
            >
              {saveMessage?.text ?? ""}
            </Typography>
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
                  sx={{ marginTop: 0, marginLeft: 0, marginBottom: 2 }}
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
