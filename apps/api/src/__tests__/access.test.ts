// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DefaultPrivacyLevel, Transaction } from "@rwa/shared";
import { assertCanViewTransaction, canViewTransaction, isTransactionParty } from "../access";

describe("canViewTransaction", () => {
  const sender = "sender-id";
  const receiver = "receiver-id";
  const otherMember = "other-member-id";
  const nobody = "nobody-id";
  const withLevel = (privacyLevel: string) =>
    ({ senderId: sender, receiverId: receiver, privacyLevel }) as Transaction;
  const level = {
    public: withLevel(DefaultPrivacyLevel.public),
    contacts: withLevel(DefaultPrivacyLevel.contacts),
    private: withLevel(DefaultPrivacyLevel.private),
  };

  it("lets the sender and the receiver see every level", () => {
    for (const transaction of Object.values(level)) {
      expect(canViewTransaction(sender, transaction)).toBe(true);
      expect(canViewTransaction(receiver, transaction)).toBe(true);
    }
  });

  it("shows a public transaction to everyone", () => {
    expect(canViewTransaction(nobody, level.public)).toBe(true);
  });

  it("the old 'contacts' level now behaves like private: only the sender and the receiver", () => {
    expect(canViewTransaction(otherMember, level.contacts)).toBe(false);
    expect(canViewTransaction(nobody, level.contacts)).toBe(false);
    expect(canViewTransaction(sender, level.contacts)).toBe(true);
  });

  it("shows a private transaction only to the sender and the receiver, even to any other member", () => {
    expect(canViewTransaction(otherMember, level.private)).toBe(false);
    expect(canViewTransaction(nobody, level.private)).toBe(false);
  });

  it("hides a transaction with an unknown privacy level", () => {
    expect(canViewTransaction(nobody, withLevel("something-new"))).toBe(false);
  });

  it("without a signed-in member, only a public transaction is visible", () => {
    expect(canViewTransaction(undefined, level.public)).toBe(true);
    expect(canViewTransaction(undefined, level.contacts)).toBe(false);
    expect(canViewTransaction(undefined, level.private)).toBe(false);
  });
});

describe("assertCanViewTransaction", () => {
  const tx = { senderId: "a", receiverId: "b", privacyLevel: "private" } as Transaction;

  it("returns the transaction when the member may see it", () => {
    expect(assertCanViewTransaction("a", tx)).toBe(tx);
  });

  it("answers 404 when it is hidden or missing (both look the same)", () => {
    expect(() => assertCanViewTransaction("c", tx)).toThrowError(
      expect.objectContaining({ status: 404 })
    );
    expect(() => assertCanViewTransaction("a", undefined)).toThrowError(
      expect.objectContaining({ status: 404 })
    );
  });
});

const asker = "sender-of-it-id";
const payer = "receiver-of-it-id";
const stranger = "stranger-id";

const request = { senderId: asker, receiverId: payer } as Transaction;

describe("isTransactionParty", () => {
  it("is true for the sender and the receiver only", () => {
    expect(isTransactionParty(asker, request)).toBe(true);
    expect(isTransactionParty(payer, request)).toBe(true);
    expect(isTransactionParty(stranger, request)).toBe(false);
  });

  it("is false when nobody is signed in", () => {
    expect(isTransactionParty(undefined, request)).toBe(false);
  });
});
