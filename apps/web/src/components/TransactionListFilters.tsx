import React from "react";
import { Box, Paper } from "@mui/material";
import { TransactionDateRangePayload, TransactionAmountFilterPayload } from "@rwa/shared";
import TransactionDateBoxesFilter from "./TransactionDateBoxesFilter";
import TransactionAmountDirectionFilter from "./TransactionAmountDirectionFilter";
import { debounce } from "lodash/fp";

export type TransactionListFiltersProps = {
  sendFilterEvent: Function;
  dateRangeFilters: TransactionDateRangePayload;
  amountRangeFilters: TransactionAmountFilterPayload;
};

const TransactionListFilters: React.FC<TransactionListFiltersProps> = ({
  sendFilterEvent,
  dateRangeFilters,
  amountRangeFilters,
}) => {
  const filterDateRange = (payload: TransactionDateRangePayload) =>
    sendFilterEvent("DATE_FILTER", payload);
  const resetDateRange = () => sendFilterEvent("DATE_RESET");

  const filterAmountRange = debounce(200, (payload: TransactionAmountFilterPayload) =>
    sendFilterEvent("AMOUNT_FILTER", payload)
  );
  const resetAmountRange = () => sendFilterEvent("AMOUNT_RESET");

  return (
    // the usual outlined border of this app, so the filters read as one group
    <Paper variant="outlined" sx={{ padding: 1.5 }} data-testid="transaction-list-filters">
      <Box display="flex" alignItems="flex-start" flexWrap="wrap" columnGap={2} rowGap={1}>
        <TransactionDateBoxesFilter
          filterDateRange={filterDateRange}
          dateRangeFilters={dateRangeFilters}
          resetDateRange={resetDateRange}
        />
        {/* right next to the date boxes; the top margin lines the chips up with the boxes */}
        <Box sx={{ marginTop: "16px", minHeight: 30, display: "flex", alignItems: "center" }}>
          <TransactionAmountDirectionFilter
            filterAmountRange={filterAmountRange}
            amountRangeFilters={amountRangeFilters}
            resetAmountRange={resetAmountRange}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default TransactionListFilters;
