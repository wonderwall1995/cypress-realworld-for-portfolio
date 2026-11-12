import React from "react";
import { Tabs, Tab, TabsActions } from "@mui/material";
import { Link, useRouteMatch } from "react-router-dom";

export default function TransactionNavTabs() {
  const match = useRouteMatch();

  // Route Lookup for tabs
  const navUrls: any = {
    "/": 0,
    "/public": 0,
    "/personal": 1,
  };

  // Set selected tab based on url
  const [value, setValue] = React.useState(navUrls[match.url]);

  const handleChange = (event: React.SyntheticEvent<{}>, newValue: number) => {
    setValue(newValue);
  };

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
      onChange={handleChange}
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
