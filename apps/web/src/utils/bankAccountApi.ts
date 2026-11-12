import { httpClient } from "./asyncUtils";
import { API_BASE } from "./apiUtils";
import { BANK_ACCOUNTS_CHANGED } from "./bankAccountEvents";
import {
  createBankAccountMutation,
  deleteBankAccountMutation,
} from "../machines/bankAccountsMachine";

/**
 * Create / delete a bank account and WAIT for the server's answer.
 * Nothing on the screen changes until the server has approved; a refusal throws an Error whose
 * message is the server's reason (turn it into a sentence with apiErrorText).
 */
const callGraphql = async (operationName: string, query: string | undefined, variables: object) => {
  let body: any;
  try {
    body = (await httpClient.post(`${API_BASE}/graphql`, { operationName, query, variables })).data;
  } catch (error: any) {
    // GraphQL may also answer a refusal with an HTTP error code
    const message = error?.response?.data?.errors?.[0]?.message;
    throw message ? new Error(message) : error;
  }
  if (Array.isArray(body?.errors) && body.errors.length > 0)
    throw new Error(body.errors[0].message);
  return body?.data;
};

export const createBankAccountRequest = async (payload: {
  bankName: string;
  accountNumber: string;
}) => {
  const data = await callGraphql("CreateBankAccount", createBankAccountMutation.loc?.source.body, {
    bankName: payload.bankName,
    accountNumber: payload.accountNumber,
  });
  if (!data?.createBankAccount) throw new Error("bank account was not created");
  window.dispatchEvent(new Event(BANK_ACCOUNTS_CHANGED));
  return data.createBankAccount;
};

export const deleteBankAccountRequest = async (id: string) => {
  const data = await callGraphql("DeleteBankAccount", deleteBankAccountMutation.loc?.source.body, {
    id,
  });
  // false: the account does not exist or is not mine
  if (data?.deleteBankAccount !== true) throw new Error("bank account not found");
  window.dispatchEvent(new Event(BANK_ACCOUNTS_CHANGED));
};
