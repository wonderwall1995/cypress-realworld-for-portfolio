import React, { useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
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
  SouthWest as DepositIcon,
  StickyNote2 as NoteIcon,
  NorthEast as TransferIcon,
} from "@mui/icons-material";

import { formatAmount } from "@rwa/shared";
import DepositDialog from "./DepositDialog";
import UpdateNotesDialog from "./UpdateNotesDialog";
import { BANK_ACCOUNTS_CHANGED } from "../utils/bankAccountEvents";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";
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
  balanceButtons: `${PREFIX}-balanceButtons`,
  bottomNav: `${PREFIX}-bottomNav`,
};

const drawerWidth = 240;

// the 은행 계좌 button while the member has no account (also when it is the open page)
const yellowButton = {
  backgroundColor: "#FFD54F",
  borderColor: "#F9A825",
  color: "#3E2723",
  "& .MuiListItemIcon-root": { color: "#3E2723" },
  "&:hover, &.Mui-selected, &.Mui-selected:hover": {
    backgroundColor: "#FFCA28",
    borderColor: "#F9A825",
    color: "#3E2723",
  },
};

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

  [`& .${classes.balanceButtons}`]: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    "& .MuiButton-root": {
      flex: 1,
      borderRadius: 20,
      fontWeight: "bold",
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
  const [depositOpen, setDepositOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const showTemporaryDrawer = useMediaQuery(theme.breakpoints.only("xs"));

  const currentUser = authState?.context?.user;
  // How many bank accounts the member has. Without any, the 은행 계좌 button turns yellow.
  // Asked again when the page changes and when an account is created, deleted or paid into.
  const [accountCount, setAccountCount] = useState<number | undefined>();
  useEffect(() => {
    let alive = true;
    const load = () =>
      httpClient
        .get(`${API_BASE}/bankAccounts`)
        .then((resp) => {
          if (alive) setAccountCount((resp.data.results as any[]).filter((a) => a.visible).length);
        })
        .catch(() => undefined);
    load();
    window.addEventListener(BANK_ACCOUNTS_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(BANK_ACCOUNTS_CHANGED, load);
    };
  }, [location.pathname]);
  const noAccounts = accountCount === 0;

  // a deposit changes the sum shown here: ask the server for the user again
  useEffect(() => {
    const refresh = () => sendAuth("REFRESH");
    window.addEventListener(BANK_ACCOUNTS_CHANGED, refresh);
    return () => window.removeEventListener(BANK_ACCOUNTS_CHANGED, refresh);
  }, [sendAuth]);

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
              alt={`${currentUser.lastName} ${currentUser.firstName}`}
              src={currentUser.avatar}
            />
            <Box>
              <Typography
                variant="subtitle1"
                color="textPrimary"
                data-testid="sidenav-user-full-name"
                noWrap
                sx={{ maxWidth: 140 }}
                title={`${currentUser.lastName} ${currentUser.firstName}`}
              >
                {currentUser.lastName} {currentUser.firstName}
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
            <Box className={classes.balanceButtons}>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<DepositIcon />}
                onClick={() => {
                  afterChoice();
                  setDepositOpen(true);
                }}
                data-testid="sidenav-deposit"
              >
                입금
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TransferIcon />}
                component={RouterLink}
                to="/transaction/new"
                onClick={afterChoice}
                data-testid="sidenav-transfer"
              >
                이체
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      <Divider />
      <List sx={{ paddingTop: 2 }}>
        {menu.map((item) => {
          const warn = noAccounts && item.to === "/bankaccounts";
          return (
            <React.Fragment key={item.to}>
              <ListItem
                button
                className={classes.menuItem}
                selected={isSelected(item.to, item.exact)}
                onClick={afterChoice}
                component={RouterLink}
                to={item.to}
                data-testid={item.testId}
                data-warning={warn ? "true" : undefined}
                sx={warn ? yellowButton : undefined}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItem>
              {warn && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  component="div"
                  data-testid="sidenav-no-bankaccount"
                  sx={{ margin: "-4px 16px 8px", paddingLeft: 2 }}
                >
                  계좌가 없습니다.
                </Typography>
              )}
            </React.Fragment>
          );
        })}
      </List>
      {/* Logout stays pinned to the bottom of the sidebar, like a footer */}
      <div className={classes.bottomNav}>
        <Divider />
        <List>
          <ListItem button onClick={() => setNotesOpen(true)} data-testid="sidenav-note">
            <ListItemIcon>
              <NoteIcon />
            </ListItemIcon>
            <ListItemText primary="Note" />
          </ListItem>
          <ListItem button onClick={() => signOut()} data-testid="sidenav-signout">
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="로그아웃" />
          </ListItem>
        </List>
      </div>
      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
      <UpdateNotesDialog open={notesOpen} onClose={() => setNotesOpen(false)} />
    </StyledDrawer>
  );
};

export default NavDrawer;
