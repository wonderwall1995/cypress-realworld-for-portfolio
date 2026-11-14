import { DemoFileKind } from "./queue";

/**
 * The look of the code files by kind. The accordion tabs, the IDE tab and the line that runs use it.
 *   test (tests/e2e/*.spec.ts): green   common (tests/e2e/common): ivory   api (tests/e2e/api): purple
 * "ring" is the rgb of the soft ring that a tab shows when the code changes to it.
 * "lineBg" and "lineBorder" are the highlight of the line that runs now (on the black code area).
 * The green one is the original highlight of the test code, the other kinds use their own color.
 */
export const KIND_LOOK: Record<
  DemoFileKind,
  {
    label: string;
    activeBg: string;
    activeText: string;
    activeBorder: string;
    idleBg: string;
    idleText: string;
    idleBorder: string;
    ring: string;
    lineBg: string;
    lineBorder: string;
  }
> = {
  test: {
    label: "테스트",
    activeBg: "#2e7d32",
    activeText: "#ffffff",
    activeBorder: "#1b5e20",
    idleBg: "#e8f5e9",
    idleText: "#1b5e20",
    idleBorder: "#81c784",
    ring: "46, 125, 50",
    lineBg: "rgba(46, 125, 50, 0.5)",
    lineBorder: "#66bb6a",
  },
  common: {
    label: "공통",
    activeBg: "#efe8a8",
    activeText: "#4e4600",
    activeBorder: "#a99f3a",
    idleBg: "#fffff0",
    idleText: "#6b6420",
    idleBorder: "#d9d49a",
    ring: "169, 159, 58",
    lineBg: "rgba(239, 232, 168, 0.28)",
    lineBorder: "#efe8a8",
  },
  api: {
    label: "API",
    activeBg: "#7b1fa2",
    activeText: "#ffffff",
    activeBorder: "#6a1b9a",
    idleBg: "#f3e5f5",
    idleText: "#6a1b9a",
    idleBorder: "#ce93d8",
    ring: "123, 31, 162",
    lineBg: "rgba(123, 31, 162, 0.6)",
    lineBorder: "#ce93d8",
  },
};
