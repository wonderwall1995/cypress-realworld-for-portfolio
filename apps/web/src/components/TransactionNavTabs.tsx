import React from "react";
import { Tabs, Tab, TabsActions } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

export default function TransactionNavTabs() {
  const { pathname } = useLocation();

  // Route Lookup for tabs
  const navUrls: any = {
    "/": 0,
    "/public": 0,
    "/personal": 1,
  };

  // the selected tab is the one of the address
  const value = navUrls[pathname] ?? false;

  // The underline under the selected tab is measured only when the window is resized.
  // Hiding or showing the sidebar changes the width of this area without a window resize,
  // so measure again every time this area changes size (also during the slide animation).
  const tabsActions = React.useRef<TabsActions | null>(null);
  const tabsRoot = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const root = tabsRoot.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => tabsActions.current?.updateIndicator());
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <Tabs
      ref={tabsRoot}
      action={tabsActions}
      value={value}
      indicatorColor="secondary"
      textColor="inherit"
      centered
      data-testid="nav-transaction-tabs"
    >
      <Tab label="전체" component={Link} to="/" data-testid="nav-public-tab" />
      <Tab label="내 거래" component={Link} to="/personal" data-testid="nav-personal-tab" />
    </Tabs>
  );
}
