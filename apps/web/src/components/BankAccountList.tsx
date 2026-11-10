import React from "react";
import { List } from "@mui/material";

import { BankAccount } from "@rwa/shared";
import BankAccountItem from "./BankAccountItem";
import EmptyList from "./EmptyList";

export interface BankAccountListProps {
  bankAccounts: BankAccount[];
  deleteBankAccount: Function;
}

const BankAccountList: React.FC<BankAccountListProps> = ({ bankAccounts, deleteBankAccount }) => {
  return (
    <>
      {bankAccounts?.length > 0 ? (
        <List data-testid="bankaccount-list">
          {bankAccounts.map((bankAccount: BankAccount) => (
            <BankAccountItem
              key={bankAccount.id}
              bankAccount={bankAccount}
              deleteBankAccount={deleteBankAccount}
            />
          ))}
        </List>
      ) : (
        <EmptyList entity="은행 계좌" />
      )}
    </>
  );
};

export default BankAccountList;
