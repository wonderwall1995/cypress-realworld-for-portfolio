import { describe, expect, it } from "vitest";
import { isValidPhoneNumber } from "../limits";

describe("phone number rule", () => {
  it("accepts the notations that the rule gives as examples", () => {
    for (const good of ["010-1234-5678", "+82 10-1234-5678", "(02) 123-4567"]) {
      expect(isValidPhoneNumber(good), good).toBe(true);
    }
  });

  it("length of a number that starts with a bracket: 7 to 20 characters", () => {
    const bracket = (length: number) => "(02)" + "1".repeat(length - 4);
    expect(isValidPhoneNumber(bracket(6))).toBe(false);
    expect(isValidPhoneNumber(bracket(7))).toBe(true);
    expect(isValidPhoneNumber(bracket(20))).toBe(true);
    expect(isValidPhoneNumber(bracket(21))).toBe(false);
  });

  it("length of a number that starts with a digit: 7 to 20 characters", () => {
    expect(isValidPhoneNumber("1".repeat(6))).toBe(false);
    expect(isValidPhoneNumber("1".repeat(7))).toBe(true);
    expect(isValidPhoneNumber("1".repeat(20))).toBe(true);
    expect(isValidPhoneNumber("1".repeat(21))).toBe(false);
  });

  it("refuses text, an empty value, a bracket without a digit and a missing end digit", () => {
    for (const bad of [
      "",
      "abcdefg",
      "((02) 123-4567",
      "() 123-4567",
      "(02) 123-456-",
      "+(02) 123-4567",
    ]) {
      expect(isValidPhoneNumber(bad), bad).toBe(false);
    }
  });
});
