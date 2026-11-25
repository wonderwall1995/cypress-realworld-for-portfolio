import React from "react";

// Use the browser's viewport scaling so portals, hit testing and the demo runner
// share the same coordinates. Pinch zoom remains available.
export const MOBILE_DESKTOP_WIDTH = 980;
const DESKTOP_WIDTH = MOBILE_DESKTOP_WIDTH;
const MOBILE_BREAKPOINT = 600;
const ViewportContext = React.createContext({ mobile: false, scale: 1, canvasScale: 1 });

const readViewport = () => {
  const viewport = window.visualViewport;
  // Unlike innerWidth, this stays in device CSS pixels after changing the meta viewport.
  const width = Math.round(viewport ? viewport.width * viewport.scale : window.innerWidth);
  const mobile =
    width < MOBILE_BREAKPOINT ||
    (width < DESKTOP_WIDTH && window.matchMedia("(pointer: coarse)").matches);
  const scale = mobile ? width / DESKTOP_WIDTH : 1;
  // Desktop responsive windows ignore the viewport meta tag. Scale the app canvas
  // there as a fallback instead of squeezing the desktop layout into a phone width.
  const canvasScale = mobile && window.innerWidth < DESKTOP_WIDTH ? scale : 1;
  return { mobile, scale, canvasScale };
};

export const useMobileDesktopViewport = () => React.useContext(ViewportContext);

export default function MobileDesktopViewport({ children }: { children: React.ReactNode }) {
  const [viewport, setViewport] = React.useState(readViewport);

  React.useLayoutEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const original = meta?.content;
    const originalMode = document.documentElement.getAttribute("data-mobile-desktop");
    const originalFooter = document.documentElement.style.getPropertyValue("--demo-footer-height");
    const update = () => {
      const next = readViewport();
      const content = next.mobile
        ? `width=${DESKTOP_WIDTH}, initial-scale=${next.scale}, viewport-fit=cover`
        : "width=device-width, initial-scale=1, viewport-fit=cover";
      if (meta && meta.content !== content) meta.content = content;
      document.documentElement.setAttribute("data-mobile-desktop", String(next.mobile));
      // Portaled application dialogs need the same bottom reservation as the player.
      const overlayScale = next.scale / next.canvasScale;
      document.documentElement.style.setProperty(
        "--demo-footer-height",
        next.mobile ? `calc(${64 / overlayScale}px + env(safe-area-inset-bottom, 0px))` : "48px"
      );
      setViewport((before) =>
        before.mobile === next.mobile &&
        before.scale === next.scale &&
        before.canvasScale === next.canvasScale
          ? before
          : next
      );
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      if (meta && original !== undefined) meta.content = original;
      if (originalMode === null) document.documentElement.removeAttribute("data-mobile-desktop");
      else document.documentElement.setAttribute("data-mobile-desktop", originalMode);
      if (originalFooter)
        document.documentElement.style.setProperty("--demo-footer-height", originalFooter);
      else document.documentElement.style.removeProperty("--demo-footer-height");
    };
  }, []);

  return <ViewportContext.Provider value={viewport}>{children}</ViewportContext.Provider>;
}
