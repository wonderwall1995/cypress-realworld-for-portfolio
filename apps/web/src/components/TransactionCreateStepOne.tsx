import React from "react";
import { styled } from "@mui/material/styles";
import { Paper } from "@mui/material";
import UsersList from "./UsersList";
import { OtherUser } from "@rwa/shared";
import UserListSearchForm from "./UserListSearchForm";

const PREFIX = "TransactionCreateStepOne";

const classes = {
  paper: `${PREFIX}-paper`,
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  [`&.${classes.paper}`]: {
    //marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
}));

export interface TransactionCreateStepOneProps {
  setReceiver: Function;
  userListSearch: Function;
  users: OtherUser[];
}

const TransactionCreateStepOne: React.FC<TransactionCreateStepOneProps> = ({
  setReceiver,
  userListSearch,
  users,
}) => {
  return (
    <StyledPaper className={classes.paper} elevation={0}>
      <UserListSearchForm userListSearch={userListSearch} />
      {/* money cannot be sent to a member who has no bank account */}
      <UsersList
        users={(users ?? []).filter((user) => user.hasBankAccount !== false)}
        setReceiver={setReceiver}
      />
    </StyledPaper>
  );
};

export default TransactionCreateStepOne;
