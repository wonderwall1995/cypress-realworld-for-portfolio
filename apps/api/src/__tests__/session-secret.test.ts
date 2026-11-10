// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionSecret } from "../session-secret";

const long = "a".repeat(40);

describe("getSessionSecret", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses SESSION_SECRET when it is set", () => {
    expect(getSessionSecret({ SESSION_SECRET: "from-env", NODE_ENV: "development" })).toBe(
      "from-env"
    );
  });

  it("makes a different random secret on each call when it is not set", () => {
    const first = getSessionSecret({ NODE_ENV: "development" });
    const second = getSessionSecret({ NODE_ENV: "development" });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
    expect(console.warn).toHaveBeenCalled();
  });

  it("treats an empty or blank value as not set", () => {
    expect(getSessionSecret({ SESSION_SECRET: "   ", NODE_ENV: "test" })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to run in production without a secret", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
  });

  it("refuses a short secret in production", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/
    );
  });

  it("accepts a long secret in production", () => {
    expect(getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: long })).toBe(long);
  });
});
