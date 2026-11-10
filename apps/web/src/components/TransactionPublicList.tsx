import React, { useEffect, ReactNode } from "react";
import { useMachine } from "@xstate/react";
import {
  TransactionPagination,
  TransactionResponseItem,
  TransactionDateRangePayload,
  TransactionAmountFilterPayload,
} from "@rwa/shared";
import TransactionList from "./TransactionList";
import { publicTransactionsMachine } from "../machines/publicTransactionsMachine";

export interface TransactionPublicListProps {
  filterComponent: ReactNode;
  dateRangeFilters: TransactionDateRangePayload;
  amountRangeFilters: TransactionAmountFilterPayload;
}

const TransactionPublicList: React.FC<TransactionPublicListProps> = ({
  filterComponent,
  dateRangeFilters,
  amountRangeFilters,
}) => {
  const [current, send, publicTransactionService] = useMachine(publicTransactionsMachine);
  const { pageData, results } = current.context;

  // @ts-ignore
  window.publicTransactionService = publicTransactionService;

  useEffect(() => {
    send("FETCH", { ...dateRangeFilters, ...amountRangeFilters });
  }, [send, dateRangeFilters, amountRangeFilters]);

  const loadNextPage = (page: number) =>
    send("FETCH", { page, ...dateRangeFilters, ...amountRangeFilters });

  return (
    <>
      <TransactionList
        filterComponent={filterComponent}
        header="공개"
        transactions={results as TransactionResponseItem[]}
        isLoading={current.matches("loading")}
        loadNextPage={loadNextPage}
        pagination={pageData as TransactionPagination}
        showCreateButton
      />
    </>
  );
};

export default TransactionPublicList;
