// @vitest-environment node
import { describe, expect, it } from "vitest";
import { omitPassword } from "../user-response";

describe("omitPassword", () => {
  const user = { id: "u1", username: "user1", firstName: "First", password: "a-hash" };

  it("removes the password field and keeps the others", () => {
    const result = omitPassword(user);

    expect(result).toEqual({ id: "u1", username: "user1", firstName: "First" });
    expect(result).not.toHaveProperty("password");
  });

  it("does not change the object it receives", () => {
    omitPassword(user);

    expect(user).toHaveProperty("password", "a-hash");
  });

  it("returns undefined when there is no user", () => {
    expect(omitPassword(undefined)).toBeUndefined();
  });

  it("works on every item of a list", () => {
    const results = [user, { ...user, id: "u2" }].map((item) => omitPassword(item));

    results.forEach((item) => expect(item).not.toHaveProperty("password"));
  });
});
