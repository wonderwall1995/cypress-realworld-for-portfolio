import React from "react";
import { styled } from "@mui/material/styles";
import clsx from "clsx";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { useActor } from "@xstate/react";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  SvgIcon,
  Badge,
  useTheme,
  useMediaQuery,
  Link,
} from "@mui/material";
import { Notifications as NotificationsIcon } from "@mui/icons-material";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { DataContext, DataEvents, DataSchema } from "../machines/dataMachine";
import TransactionNavTabs from "./TransactionNavTabs";
import RWALogo from "./SvgRwaLogo";
import RWALogoIcon from "./SvgRwaIconLogo";
import SourceCredit from "./SourceCredit";

const drawerWidth = 240;

// A big filled triangle: "<" when the sidebar is open (click hides it), ">" when it is hidden.
const TriangleIcon = ({ direction }: { direction: "left" | "right" }) => (
  <SvgIcon data-testid="drawer-icon" sx={{ fontSize: 32 }} viewBox="0 0 24 24">
    <path d={direction === "left" ? "M17 4 L6 12 L17 20 Z" : "M7 4 L18 12 L7 20 Z"} />
  </SvgIcon>
);

const PREFIX = "NavBar";

const classes = {
  toolbar: `${PREFIX}-toolbar`,
  appBar: `${PREFIX}-appBar`,
  appBarShift: `${PREFIX}-appBarShift`,
  menuButtonHidden: `${PREFIX}-menuButtonHidden`,
  title: `${PREFIX}-title`,
  logo: `${PREFIX}-logo`,
  customBadge: `${PREFIX}-customBadge`,
  zeroBadge: `${PREFIX}-zeroBadge`,
};

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  [`& .${classes.toolbar}`]: {
    paddingRight: 24, // keep right padding when drawer closed
  },

  [`&.${classes.appBar}`]: {
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  [`&.${classes.appBarShift}`]: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },

  [`& .${classes.menuButtonHidden}`]: {
    display: "none",
  },

  [`& .${classes.title}`]: {
    flexGrow: 1,
    textAlign: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },

  [`& .${classes.logo}`]: {
    color: "white",
    verticalAlign: "bottom",
  },

  [`& .${classes.customBadge}`]: {
    backgroundColor: "red",
    color: "white",
  },

  // nothing new: show 0 quietly instead of a red dot
  [`& .${classes.zeroBadge}`]: {
    backgroundColor: "rgba(255,255,255,0.3)",
    color: "white",
  },
}));

interface NavBarProps {
  drawerOpen: boolean;
  toggleDrawer: Function;
  notificationsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
}

const NavBar: React.FC<NavBarProps> = ({ drawerOpen, toggleDrawer, notificationsService }) => {
  const match = useLocation();

  const theme = useTheme();
  const [notificationsState] = useActor(notificationsService);

  const allNotifications = notificationsState?.context?.results;
  const unreadCount = allNotifications ? allNotifications.length : 0;
  const xsBreakpoint = useMediaQuery(theme.breakpoints.only("xs"));

  return (
    <StyledAppBar
      position="absolute"
      className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
    >
      <Toolbar className={classes.toolbar}>
        <IconButton
          data-testid="sidenav-toggle"
          edge="start"
          color="inherit"
          aria-label={drawerOpen ? "메뉴 닫기" : "메뉴 열기"}
          onClick={() => toggleDrawer()}
          sx={{ border: "2px solid currentColor", borderRadius: "8px", padding: "2px" }}
        >
          <TriangleIcon direction={drawerOpen ? "left" : "right"} />
        </IconButton>
        <Box className={classes.title}>
          <Typography
            component="h1"
            variant="h6"
            color="inherit"
            noWrap
            data-testid="app-name-logo"
          >
            <Link
              to="/"
              data-testid="nav-bar-home-link"
              style={{ color: "#fff", textDecoration: "none" }}
              component={RouterLink}
              underline="hover"
            >
              {xsBreakpoint ? (
                <RWALogoIcon className={classes.logo} />
              ) : (
                <RWALogo className={classes.logo} />
              )}
            </Link>
          </Typography>
          <SourceCredit light />
        </Box>
        <IconButton
          color="inherit"
          component={RouterLink}
          to="/notifications"
          data-testid="nav-top-notifications-link"
          size="large"
        >
          <Badge
            badgeContent={unreadCount}
            max={99}
            showZero
            data-testid="nav-top-notifications-count"
            classes={{ badge: unreadCount > 0 ? classes.customBadge : classes.zeroBadge }}
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Toolbar>
      {(match.pathname === "/" || RegExp("/(?:public|contacts|personal)").test(match.pathname)) && (
        <TransactionNavTabs />
      )}
    </StyledAppBar>
  );
};

export default NavBar;
