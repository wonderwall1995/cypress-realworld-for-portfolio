import React from "react";
import { styled } from "@mui/material/styles";
import { head } from "lodash/fp";
import { Interpreter } from "xstate";
import { useActor } from "@xstate/react";
import clsx from "clsx";
import {
  useMediaQuery,
  useTheme,
  Box,
  Button,
  Drawer,
  List,
  Divider,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  AccountBalance as AccountBalanceIcon,
  AttachMoney as AttachMoneyIcon,
} from "@mui/icons-material";

import { formatAmount } from "@rwa/shared";
import { AuthMachineContext, AuthMachineEvents } from "../machines/authMachine";

const PREFIX = "NavDrawer";

const classes = {
  drawerPaper: `${PREFIX}-drawerPaper`,
  drawerPaperClose: `${PREFIX}-drawerPaperClose`,
  userProfile: `${PREFIX}-userProfile`,
  userProfileHidden: `${PREFIX}-userProfileHidden`,
  avatar: `${PREFIX}-avatar`,
  balanceBox: `${PREFIX}-balanceBox`,
  amount: `${PREFIX}-amount`,
  menuItem: `${PREFIX}-menuItem`,
  newTransactionButton: `${PREFIX}-newTransactionButton`,
  bottomNav: `${PREFIX}-bottomNav`,
};

const drawerWidth = 240;

const StyledDrawer = styled(Drawer)(({ theme }) => ({
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

  // profile and balance form one block: the balance sits right under the profile
  [`& .${classes.userProfile}`]: {
    padding: theme.spacing(2, 2, 1),
  },

  [`& .${classes.userProfileHidden}`]: {
    display: "none",
  },

  [`& .${classes.avatar}`]: {
    marginRight: theme.spacing(2),
  },

  [`& .${classes.balanceBox}`]: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1, 2),
    borderRadius: 12,
    backgroundColor: theme.palette.grey[100],
  },

  [`& .${classes.amount}`]: {
    fontWeight: "bold",
    lineHeight: 1.2,
  },

  // every menu entry is a round button
  [`& .${classes.menuItem}`]: {
    width: "auto",
    margin: theme.spacing(0, 2, 1),
    borderRadius: 24,
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&.Mui-selected": {
      backgroundColor: theme.palette.primary.main,
      borderColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      "& .MuiListItemIcon-root": {
        color: theme.palette.primary.contrastText,
      },
      "&:hover": {
        backgroundColor: theme.palette.primary.dark,
      },
    },
  },

  [`& .${classes.newTransactionButton}`]: {
    margin: theme.spacing(0, 2, 1),
    width: `calc(100% - ${theme.spacing(4)})`,
    borderRadius: 24,
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "#00C853",
    color: "#fff",
    "&:hover": {
      backgroundColor: "#4CAF50",
      boxShadow: "none",
    },
  },

  [`& .${classes.bottomNav}`]: {
    marginTop: "auto",
  },
}));

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
  const location = useLocation();
  const [authState, sendAuth] = useActor(authService);
  const showTemporaryDrawer = useMediaQuery(theme.breakpoints.only("xs"));

  const currentUser = authState?.context?.user;
  const signOut = () => sendAuth("LOGOUT");

  // on a phone the drawer covers the page, so close it after a choice
  const afterChoice = () => {
    if (showTemporaryDrawer) toggleDrawer();
  };

  const menu = [
    { to: "/", label: "홈", icon: <HomeIcon />, testId: "sidenav-home", exact: true },
    {
      to: "/user/settings",
      label: "내 계정",
      icon: <PersonIcon />,
      testId: "sidenav-user-settings",
    },
    {
      to: "/bankaccounts",
      label: "은행 계좌",
      icon: <AccountBalanceIcon />,
      testId: "sidenav-bankaccounts",
    },
  ];

  const isSelected = (to: string, exact?: boolean) =>
    exact
      ? location.pathname === "/" || /^\/(public|contacts|personal)/.test(location.pathname)
      : location.pathname.startsWith(to);

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
      <Box className={drawerOpen ? classes.userProfile : classes.userProfileHidden}>
        {currentUser && (
          <Box display="flex" alignItems="center">
            <Avatar
              className={classes.avatar}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
              src={currentUser.avatar}
            />
            <Box>
              <Typography
                variant="subtitle1"
                color="textPrimary"
                data-testid="sidenav-user-full-name"
              >
                {currentUser.firstName} {head(currentUser.lastName)}
              </Typography>
              <Typography variant="subtitle2" color="inherit" data-testid="sidenav-username">
                @{currentUser.username}
              </Typography>
            </Box>
          </Box>
        )}
        {currentUser && (
          <Box className={classes.balanceBox} data-testid="sidenav-balance-box">
            <Typography variant="caption" color="textSecondary" component="div">
              잔액
            </Typography>
            <Typography
              variant="h6"
              color="textPrimary"
              className={classes.amount}
              data-testid="sidenav-user-balance"
            >
              {currentUser.balance ? formatAmount(currentUser.balance) : formatAmount(0)}
            </Typography>
          </Box>
        )}
      </Box>
      <Divider />
      <List sx={{ paddingTop: 2 }}>
        {menu.map((item) => (
          <ListItem
            key={item.to}
            button
            className={classes.menuItem}
            selected={isSelected(item.to, item.exact)}
            onClick={afterChoice}
            component={RouterLink}
            to={item.to}
            data-testid={item.testId}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
      {/* New transaction and Logout stay pinned to the bottom of the sidebar, like a footer */}
      <div className={classes.bottomNav}>
        <Button
          className={classes.newTransactionButton}
          variant="contained"
          color="inherit"
          component={RouterLink}
          to="/transaction/new"
          onClick={afterChoice}
          data-testid="sidenav-new-transaction"
        >
          <AttachMoneyIcon /> 새 거래
        </Button>
        <Divider />
        <List>
          <ListItem button onClick={() => signOut()} data-testid="sidenav-signout">
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="로그아웃" />
          </ListItem>
        </List>
      </div>
    </StyledDrawer>
  );
};

export default NavDrawer;
