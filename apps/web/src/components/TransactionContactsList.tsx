import React, { useEffect, ReactNode } from "react";
import { useMachine } from "@xstate/react";
import {
  TransactionPagination,
  TransactionResponseItem,
  TransactionDateRangePayload,
  TransactionAmountFilterPayload,
} from "@rwa/shared";
import TransactionList from "./TransactionList";
import { contactsTransactionsMachine } from "../machines/contactsTransactionsMachine";

export interface TransactionContactListProps {
  filterComponent: ReactNode;
  dateRangeFilters: TransactionDateRangePayload;
  amountRangeFilters: TransactionAmountFilterPayload;
}

const TransactionContactsList: React.FC<TransactionContactListProps> = ({
  filterComponent,
  dateRangeFilters,
  amountRangeFilters,
}) => {
  const [current, send, contactTransactionService] = useMachine(contactsTransactionsMachine);
  const { pageData, results } = current.context;

  // @ts-ignore
  window.contactTransactionService = contactTransactionService;

  useEffect(() => {
    send("FETCH", { ...dateRangeFilters, ...amountRangeFilters });
  }, [send, dateRangeFilters, amountRangeFilters]);

  const loadNextPage = (page: number) =>
    send("FETCH", { page, ...dateRangeFilters, ...amountRangeFilters });

  return (
    <>
      <TransactionList
        filterComponent={filterComponent}
        header="친구"
        transactions={results as TransactionResponseItem[]}
        isLoading={current.matches("loading")}
        loadNextPage={loadNextPage}
        pagination={pageData as TransactionPagination}
        showCreateButton
      />
    </>
  );
};

export default TransactionContactsList;
