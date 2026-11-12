import React, { useState } from "react";
import { styled } from "@mui/material/styles";
import { Paper, Typography, Grid } from "@mui/material";
import UserSettingsForm, { SaveMessage } from "../components/UserSettingsForm";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";
import { Interpreter } from "xstate";
import { AuthMachineContext, AuthMachineEvents } from "../machines/authMachine";
import { useActor } from "@xstate/react";
import PersonalSettingsIllustration from "../components/SvgUndrawPersonalSettingsKihd";

const PREFIX = "UserSettingsContainer";

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

export interface Props {
  authService: Interpreter<AuthMachineContext, any, AuthMachineEvents, any>;
}

const UserSettingsContainer: React.FC<Props> = ({ authService }) => {
  const [authState, sendAuth] = useActor(authService);

  const currentUser = authState?.context?.user;
  const [saveMessage, setSaveMessage] = useState<SaveMessage | undefined>();

  // The save is sent here (not through the login state machine), so a refused save
  // shows a message and never logs the member out.
  const updateUser = async (payload: any) => {
    setSaveMessage(undefined);
    try {
      await httpClient.patch(`${API_BASE}/users/${payload.id}`, payload);
      sendAuth("REFRESH"); // read the saved values again (sidebar, name)
      setSaveMessage({ kind: "success", text: "설정 저장 성공" });
    } catch (error: any) {
      const reason = error?.response?.data?.error;
      setSaveMessage({
        kind: "error",
        text: reason ? `설정 저장 실패: ${reason}` : "설정 저장 실패: 잠시 뒤 다시 시도하세요",
      });
    }
  };

  return (
    <StyledPaper className={classes.paper}>
      <Typography component="h2" variant="h6" color="primary" gutterBottom>
        사용자 설정
      </Typography>
      <Grid
        container
        spacing={2}
        direction="row"
        justifyContent="flex-start"
        alignItems="flex-start"
      >
        <Grid item>
          <PersonalSettingsIllustration style={{ height: 200, width: 300 }} />
        </Grid>
        <Grid item style={{ width: "50%" }}>
          {currentUser && (
            <UserSettingsForm
              userProfile={currentUser}
              updateUser={updateUser}
              saveMessage={saveMessage}
              onEdit={() => setSaveMessage(undefined)}
            />
          )}
        </Grid>
      </Grid>
    </StyledPaper>
  );
};
export default UserSettingsContainer;
