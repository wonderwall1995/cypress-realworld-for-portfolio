import React from "react";
import { styled } from "@mui/material/styles";
import { head } from "lodash/fp";
import { Interpreter } from "xstate";
import { useActor } from "@xstate/react";
import clsx from "clsx";
import {
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  Divider,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Avatar,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  Home as HomeIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  Notifications as NotificationsIcon,
  AccountBalance as AccountBalanceIcon,
} from "@mui/icons-material";

import { formatAmount } from "@rwa/shared";
import { AuthMachineContext, AuthMachineEvents } from "../machines/authMachine";

const PREFIX = "NavDrawer";

const classes = {
  toolbar: `${PREFIX}-toolbar`,
  toolbarIcon: `${PREFIX}-toolbarIcon`,
  drawerPaper: `${PREFIX}-drawerPaper`,
  drawerPaperClose: `${PREFIX}-drawerPaperClose`,
  userProfile: `${PREFIX}-userProfile`,
  userProfileHidden: `${PREFIX}-userProfileHidden`,
  avatar: `${PREFIX}-avatar`,
  accountBalance: `${PREFIX}-accountBalance`,
  amount: `${PREFIX}-amount`,
  accountBalanceHidden: `${PREFIX}-accountBalanceHidden`,
  bottomNav: `${PREFIX}-bottomNav`,
};

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  [`& .${classes.toolbar}`]: {
    paddingRight: 24, // keep right padding when drawer closed
  },

  [`& .${classes.toolbarIcon}`]: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "0 8px",
    ...theme.mixins.toolbar,
  },

  [`& .${classes.drawerPaper}`]: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },

  [`& .${classes.drawerPaperClose}`]: {
    marginTop: 50,
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
  },

  [`& .${classes.userProfile}`]: {
    padding: theme.spacing(2),
  },

  [`& .${classes.userProfileHidden}`]: {
    display: "none",
  },

  [`& .${classes.avatar}`]: {
    marginRight: theme.spacing(2),
  },

  [`& .${classes.accountBalance}`]: {
    marginLeft: theme.spacing(2),
  },

  [`& .${classes.amount}`]: {
    fontWeight: "bold",
  },

  [`& .${classes.accountBalanceHidden}`]: {
    display: "none",
  },

  [`& .${classes.bottomNav}`]: {
    marginTop: "auto",
  },
}));

const drawerWidth = 240;

export const mainListItems = (
  toggleDrawer: ((event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void) | undefined,
  showTemporaryDrawer: Boolean
) => (
  <div>
    <ListItem
      button
      // @ts-ignore
      onClick={() => showTemporaryDrawer && toggleDrawer()}
      component={RouterLink}
      to="/"
      data-testid="sidenav-home"
    >
      <ListItemIcon>
        <HomeIcon />
      </ListItemIcon>
      <ListItemText primary="홈" />
    </ListItem>
    <ListItem
      button
      // @ts-ignore
      onClick={() => showTemporaryDrawer && toggleDrawer()}
      component={RouterLink}
      to="/user/settings"
      data-testid="sidenav-user-settings"
    >
      <ListItemIcon>
        <PersonIcon />
      </ListItemIcon>
      <ListItemText primary="내 계정" />
    </ListItem>
    <ListItem
      button
      // @ts-ignore
      onClick={() => showTemporaryDrawer && toggleDrawer()}
      component={RouterLink}
      to="/bankaccounts"
      data-testid="sidenav-bankaccounts"
    >
      <ListItemIcon>
        <AccountBalanceIcon />
      </ListItemIcon>
      <ListItemText primary="은행 계좌" />
    </ListItem>
    <ListItem
      button
      // @ts-ignore
      onClick={() => showTemporaryDrawer && toggleDrawer()}
      component={RouterLink}
      to="/notifications"
      data-testid="sidenav-notifications"
    >
      <ListItemIcon>
        <NotificationsIcon />
      </ListItemIcon>
      <ListItemText primary="알림" />
    </ListItem>
  </div>
);

export const secondaryListItems = (signOutPending: Function) => (
  <div>
    <ListItem button onClick={() => signOutPending()} data-testid="sidenav-signout">
      <ListItemIcon>
        <LogoutIcon />
      </ListItemIcon>
      <ListItemText primary="로그아웃" />
    </ListItem>
  </div>
);

interface Props {
  closeMobileDrawer: () => void;
  toggleDrawer: () => void;
  drawerOpen: boolean;
  authService: Interpreter<AuthMachineContext, any, AuthMachineEvents, any>;
}

const NavDrawer: React.FC<Props> = ({
  toggleDrawer,
  closeMobileDrawer,
  drawerOpen,
  authService,
}) => {
  const theme = useTheme();
  const [authState, sendAuth] = useActor(authService);
  const showTemporaryDrawer = useMediaQuery(theme.breakpoints.only("xs"));

  const currentUser = authState?.context?.user;
  const signOut = () => sendAuth("LOGOUT");

  return (
    <StyledDrawer
      data-testid="sidenav"
      variant={showTemporaryDrawer ? "temporary" : "persistent"}
      classes={{
        paper: clsx(classes.drawerPaper, !drawerOpen && classes.drawerPaperClose),
      }}
      open={drawerOpen}
      ModalProps={{
        onBackdropClick: () => closeMobileDrawer(),
        closeAfterTransition: showTemporaryDrawer,
      }}
    >
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        className={drawerOpen ? classes.userProfile : classes.userProfileHidden}
      >
        <Grid item>
          {currentUser && (
            <Avatar
              className={classes.avatar}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
              src={currentUser.avatar}
            />
          )}
        </Grid>
        <Grid item>
          {currentUser && (
            <>
              <Typography
                variant="subtitle1"
                color="textPrimary"
                data-testid="sidenav-user-full-name"
              >
                {currentUser.firstName} {head(currentUser.lastName)}
              </Typography>
              <Typography
                variant="subtitle2"
                color="inherit"
                gutterBottom
                data-testid="sidenav-username"
              >
                @{currentUser.username}
              </Typography>
            </>
          )}
        </Grid>
        <Grid item style={{ width: "30%" }}></Grid>
      </Grid>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        className={drawerOpen ? classes.userProfile : classes.userProfileHidden}
      >
        <Grid item>
          {currentUser && (
            <>
              <Typography
                variant="h6"
                color="textPrimary"
                className={classes.amount}
                data-testid="sidenav-user-balance"
              >
                {currentUser.balance ? formatAmount(currentUser.balance) : formatAmount(0)}
              </Typography>
              <Typography variant="subtitle2" color="inherit" gutterBottom>
                잔액
              </Typography>
            </>
          )}
        </Grid>
        <Grid item>
          <Divider />
        </Grid>
        <Grid item>
          <List>{mainListItems(toggleDrawer, showTemporaryDrawer)}</List>
        </Grid>
      </Grid>
      {/* Logout stays pinned to the bottom of the sidebar, like a footer */}
      <div className={classes.bottomNav}>
        <Divider />
        <List>{secondaryListItems(signOut)}</List>
      </div>
    </StyledDrawer>
  );
};

export default NavDrawer;
