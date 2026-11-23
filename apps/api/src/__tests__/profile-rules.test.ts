// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validationResult } from "express-validator";
import { isProfileNameValidator } from "../validators";

const refused = async (body: Record<string, unknown>) => {
  const req: any = { body };
  await Promise.all(isProfileNameValidator.map((rule) => rule.run(req)));
  return [
    ...new Set(
      validationResult(req)
        .array()
        .map((error: any) => error.param ?? error.path)
    ),
  ];
};

describe("profile change: names", () => {
  it("refuses an empty or blank name", async () => {
    expect(await refused({ firstName: "", lastName: "Lee" })).toEqual(["firstName"]);
    expect(await refused({ firstName: "Kim", lastName: "   " })).toEqual(["lastName"]);
    expect(await refused({ firstName: "", lastName: "" })).toEqual(["firstName", "lastName"]);
  });

  it("refuses a name that is not text", async () => {
    for (const bad of [null, 1, true, {}]) {
      expect(await refused({ firstName: bad, lastName: "Lee" }), String(bad)).toEqual([
        "firstName",
      ]);
    }
  });

  it("accepts one letter, a long name, and a change without names", async () => {
    expect(await refused({ firstName: "김", lastName: "L".repeat(30) })).toEqual([]);
    expect(await refused({ avatar: "x" })).toEqual([]);
  });
});
