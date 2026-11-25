import React, { useEffect } from "react";
import { styled } from "@mui/material/styles";
import { useMachine } from "@xstate/react";
import {
  BaseActionObject,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  TypegenDisabled,
} from "xstate";
import { Container, Grid, useMediaQuery, useTheme } from "@mui/material";

import { FOOTER_HEIGHT, MOBILE_FOOTER_SPACE } from "../demo/layout";
import NavBar from "./NavBar";
import NavDrawer from "./NavDrawer";
import { DataContext, DataEvents, DataSchema } from "../machines/dataMachine";
import { AuthMachineContext, AuthMachineEvents, AuthMachineSchema } from "../machines/authMachine";
import { drawerMachine } from "../machines/drawerMachine";
import { useMobileDesktopViewport } from "./MobileDesktopViewport";

const PREFIX = "MainLayout";

const classes = {
  toolbar: `${PREFIX}-toolbar`,
  appBarSpacer: `${PREFIX}-appBarSpacer`,
  content: `${PREFIX}-content`,
  container: `${PREFIX}-container`,
};
// TODO jss-to-styled codemod: The Fragment root was replaced by div. Change the tag if needed.
const Root = styled("div")(({ theme }) => ({
  [`&`]: { display: "flex", flexGrow: 1, minWidth: 0 },

  [`& .${classes.toolbar}`]: {
    paddingRight: 24, // keep right padding when drawer closed
  },

  [`& .${classes.appBarSpacer}`]: {
    minHeight: theme.spacing(13),
    [theme.breakpoints.down("sm")]: { minHeight: 152 },
    [theme.breakpoints.up("sm")]: {
      minHeight: theme.spacing(14),
    },
  },

  [`& .${classes.content}`]: {
    flexGrow: 1,
    height: `calc(100vh - ${FOOTER_HEIGHT}px)`, // the demo footer takes the bottom of the window
    overflow: "auto",
    minWidth: 0,
    [theme.breakpoints.down("sm")]: {
      height: `calc(100dvh - ${MOBILE_FOOTER_SPACE} - 48px)`,
      overscrollBehavior: "contain",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    },
  },

  [`& .${classes.container}`]: {
    minHeight: "77vh",
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      minHeight: 0,
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
      paddingBottom: theme.spacing(4),
    },
    [theme.breakpoints.up("sm")]: {
      paddingTop: theme.spacing(4),
      padding: theme.spacing(4),
    },
  },
}));

interface Props {
  children: React.ReactNode;
  authService: Interpreter<AuthMachineContext, AuthMachineSchema, AuthMachineEvents, any, any>;
  notificationsService: Interpreter<
    DataContext,
    DataSchema,
    DataEvents,
    any,
    ResolveTypegenMeta<TypegenDisabled, DataEvents, BaseActionObject, ServiceMap>
  >;
}

const MainLayout: React.FC<Props> = ({ children, notificationsService, authService }) => {
  const { mobile } = useMobileDesktopViewport();
  const theme = useTheme();
  const [drawerState, sendDrawer] = useMachine(drawerMachine);

  const aboveSmallBreakpoint = useMediaQuery(theme.breakpoints.up("sm"));
  const xsBreakpoint = useMediaQuery(theme.breakpoints.only("xs"));

  const desktopDrawerOpen = drawerState?.matches({ desktop: "open" });
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(true);
  const toggleDesktopDrawer = () => {
    sendDrawer("TOGGLE_DESKTOP");
  };
  const toggleMobileDrawer = () => {
    setMobileDrawerOpen((open) => !open);
  };

  const openDesktopDrawer = (payload: any) => sendDrawer("OPEN_DESKTOP", payload);

  useEffect(() => {
    if (!desktopDrawerOpen && aboveSmallBreakpoint) {
      openDesktopDrawer({ aboveSmallBreakpoint });
    }
  }, [aboveSmallBreakpoint, desktopDrawerOpen]);

  return (
    <Root
      sx={
        mobile
          ? {
              height: "100%",
              [`& .${classes.content}`]: { height: "100%", overscrollBehavior: "contain" },
            }
          : undefined
      }
    >
      <NavBar
        toggleDrawer={mobile || xsBreakpoint ? toggleMobileDrawer : toggleDesktopDrawer}
        drawerOpen={mobile || xsBreakpoint ? mobileDrawerOpen : desktopDrawerOpen}
        notificationsService={notificationsService}
      />
      <div
        data-testid="sidebar-slot"
        style={mobile ? { width: 240, flexShrink: 0, height: "100%" } : { display: "contents" }}
      >
        <NavDrawer
          drawerOpen={mobile || xsBreakpoint ? mobileDrawerOpen : desktopDrawerOpen}
          authService={authService}
        />
      </div>
      <main className={classes.content} data-testid="main">
        <div className={classes.appBarSpacer} />
        <Container maxWidth="md" className={classes.container}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              {children}
            </Grid>
          </Grid>
        </Container>
      </main>
    </Root>
  );
};

export default MainLayout;
