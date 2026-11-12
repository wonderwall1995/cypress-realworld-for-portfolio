import React from "react";
import { useMachine } from "@xstate/react";
import { Switch, Route, Redirect } from "react-router";
import { TransactionDateRangePayload, TransactionAmountFilterPayload } from "@rwa/shared";
import TransactionListFilters from "../components/TransactionListFilters";
import { transactionFiltersMachine } from "../machines/transactionFiltersMachine";
import { getDateQueryFields, getAmountQueryFields } from "@rwa/shared";
import TransactionPersonalList from "../components/TransactionPersonalList";
import TransactionPublicList from "../components/TransactionPublicList";

const TransactionsContainer: React.FC = () => {
  const [currentFilters, sendFilterEvent] = useMachine(transactionFiltersMachine);

  const hasDateRangeFilter = currentFilters.matches({ dateRange: "filter" });
  const hasAmountRangeFilter = currentFilters.matches({
    amountRange: "filter",
  });

  const dateRangeFilters = hasDateRangeFilter && getDateQueryFields(currentFilters.context);
  const amountRangeFilters = hasAmountRangeFilter && getAmountQueryFields(currentFilters.context);

  const Filters = (
    <TransactionListFilters
      dateRangeFilters={dateRangeFilters as TransactionDateRangePayload}
      amountRangeFilters={amountRangeFilters as TransactionAmountFilterPayload}
      sendFilterEvent={sendFilterEvent}
    />
  );

  return (
    <Switch>
      {/* the friends tab is gone: an old bookmark goes to the main list */}
      <Route exact path="/contacts">
        <Redirect to="/" />
      </Route>
      <Route exact path="/personal">
        <TransactionPersonalList
          filterComponent={Filters}
          dateRangeFilters={dateRangeFilters as TransactionDateRangePayload}
          amountRangeFilters={amountRangeFilters as TransactionAmountFilterPayload}
        />
      </Route>
      <Route exact path="/(public)?">
        <TransactionPublicList
          filterComponent={Filters}
          dateRangeFilters={dateRangeFilters as TransactionDateRangePayload}
          amountRangeFilters={amountRangeFilters as TransactionAmountFilterPayload}
        />
      </Route>
    </Switch>
  );
};

export default TransactionsContainer;
