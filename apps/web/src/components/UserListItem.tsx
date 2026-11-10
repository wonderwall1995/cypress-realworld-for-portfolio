import React from "react";
import { ListItem, ListItemText, ListItemAvatar, Avatar, Grid } from "@mui/material";

import { User } from "@rwa/shared";

export interface UserListItemProps {
  user: User;
  setReceiver: Function;
  index: Number;
}

const UserListItem: React.FC<UserListItemProps> = ({ user, setReceiver, index }) => {
  return (
    <ListItem data-testid={`user-list-item-${user.id}`} onClick={() => setReceiver(user)}>
      <ListItemAvatar>
        <Avatar src={user.avatar} />
      </ListItemAvatar>
      <ListItemText
        primary={`${user.firstName} ${user.lastName}`}
        secondary={
          <span>
            <Grid
              component={"span"}
              container
              direction="row"
              justifyContent="flex-start"
              alignItems="flex-start"
              spacing={1}
            >
              <Grid item component={"span"}>
                <b>사용자: </b>
                {user.username}
              </Grid>
              <Grid item component={"span"}>
                &bull;
              </Grid>
              <Grid item component={"span"}>
                <b>이메일: </b>
                {user.email}
              </Grid>
              <Grid item component={"span"}>
                &bull;
              </Grid>
              <Grid item component={"span"}>
                <b>전화: </b>
                {user.phoneNumber}
              </Grid>
            </Grid>
          </span>
        }
      />
    </ListItem>
  );
};

export default UserListItem;
