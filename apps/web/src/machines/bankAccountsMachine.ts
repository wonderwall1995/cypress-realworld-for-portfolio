import gql from "graphql-tag";
import { dataMachine } from "./dataMachine";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";

const listBankAccountQuery = gql`
  query ListBankAccount {
    listBankAccount {
      id
      uuid
      userId
      bankName
      accountNumber
      visible
      balance
      createdAt
      modifiedAt
    }
  }
`;

export const deleteBankAccountMutation = gql`
  mutation DeleteBankAccount($id: ID!) {
    deleteBankAccount(id: $id)
  }
`;

export const createBankAccountMutation = gql`
  mutation CreateBankAccount($bankName: String!, $accountNumber: String!) {
    createBankAccount(bankName: $bankName, accountNumber: $accountNumber) {
      id
      uuid
      userId
      bankName
      accountNumber
      visible
      balance
      createdAt
    }
  }
`;

export const bankAccountsMachine = dataMachine("bankAccounts").withConfig({
  services: {
    fetchData: async (ctx, event: any) => {
      const resp = await httpClient.post(`${API_BASE}/graphql`, {
        operationName: "ListBankAccount",
        query: listBankAccountQuery.loc?.source.body,
      });
      // @ts-ignore
      return { results: resp.data.data.listBankAccount, pageData: {} };
    },
  },
});
