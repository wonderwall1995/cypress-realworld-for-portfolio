// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DefaultPrivacyLevel, Transaction } from "@rwa/shared";
import {
  assertCanAnswerRequest,
  assertCanViewTransaction,
  canViewTransaction,
  isTransactionParty,
} from "../access";

describe("canViewTransaction", () => {
  const sender = "sender-id";
  const receiver = "receiver-id";
  const contactOfSender = "contact-of-sender-id";
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
      expect(canViewTransaction(sender, transaction, [])).toBe(true);
      expect(canViewTransaction(receiver, transaction, [])).toBe(true);
    }
  });

  it("shows a public transaction to everyone", () => {
    expect(canViewTransaction(nobody, level.public, [])).toBe(true);
  });

  it("shows a contacts transaction only to members with the sender or the receiver as a contact", () => {
    expect(canViewTransaction(contactOfSender, level.contacts, [sender])).toBe(true);
    expect(canViewTransaction(contactOfSender, level.contacts, [receiver])).toBe(true);
    expect(canViewTransaction(nobody, level.contacts, [])).toBe(false);
    expect(canViewTransaction(nobody, level.contacts, ["somebody-else"])).toBe(false);
  });

  it("shows a private transaction only to the sender and the receiver, even to a contact", () => {
    expect(canViewTransaction(contactOfSender, level.private, [sender, receiver])).toBe(false);
    expect(canViewTransaction(nobody, level.private, [])).toBe(false);
  });

  it("hides a transaction with an unknown privacy level", () => {
    expect(canViewTransaction(nobody, withLevel("something-new"), [sender])).toBe(false);
  });

  it("without a signed-in member, only a public transaction is visible", () => {
    expect(canViewTransaction(undefined, level.public, [])).toBe(true);
    expect(canViewTransaction(undefined, level.contacts, [])).toBe(false);
    expect(canViewTransaction(undefined, level.private, [])).toBe(false);
  });
});

describe("assertCanViewTransaction", () => {
  const tx = { senderId: "a", receiverId: "b", privacyLevel: "private" } as Transaction;

  it("returns the transaction when the member may see it", () => {
    expect(assertCanViewTransaction("a", tx, [])).toBe(tx);
  });

  it("answers 404 when it is hidden or missing (both look the same)", () => {
    expect(() => assertCanViewTransaction("c", tx, [])).toThrowError(
      expect.objectContaining({ status: 404 })
    );
    expect(() => assertCanViewTransaction("a", undefined, [])).toThrowError(
      expect.objectContaining({ status: 404 })
    );
  });
});

const asker = "asker-id"; // sender of the request: asks for money
const payer = "payer-id"; // receiver of the request: is asked to pay
const stranger = "stranger-id";

const request = { senderId: asker, receiverId: payer, requestStatus: "pending" } as Transaction;
const payment = { senderId: asker, receiverId: payer, requestStatus: "" } as Transaction;

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

describe("assertCanAnswerRequest", () => {
  it("lets the member who was asked answer", () => {
    expect(() => assertCanAnswerRequest(payer, request)).not.toThrow();
  });

  it("refuses the member who asked (403)", () => {
    expect(() => assertCanAnswerRequest(asker, request)).toThrowError(
      expect.objectContaining({ status: 403 })
    );
  });

  it("refuses a member who is not in the transaction (404, same as a missing one)", () => {
    expect(() => assertCanAnswerRequest(stranger, request)).toThrowError(
      expect.objectContaining({ status: 404 })
    );
  });

  it("answers 404 when the transaction does not exist or nobody is signed in", () => {
    expect(() => assertCanAnswerRequest(payer, undefined)).toThrowError(
      expect.objectContaining({ status: 404 })
    );
    expect(() => assertCanAnswerRequest(undefined, request)).toThrowError(
      expect.objectContaining({ status: 404 })
    );
  });

  it("refuses to answer a payment (400)", () => {
    expect(() => assertCanAnswerRequest(payer, payment)).toThrowError(
      expect.objectContaining({ status: 400 })
    );
  });
});
