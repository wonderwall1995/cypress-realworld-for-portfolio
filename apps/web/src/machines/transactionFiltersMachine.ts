import { Machine, assign } from "xstate";

interface FilterSchema {
  states: {
    dateRange: {
      states: {
        none: {};
        filter: {};
      };
    };
    amountRange: {
      states: {
        none: {};
        filter: {};
      };
    };
  };
}

type DateFilterEvent = {
  type: "DATE_FILTER";
  dateRangeStart: string;
  dateRangeEnd: string;
};
// deposit / withdrawal filter, in cents. A group that is not given does not filter.
type AmountFilterEvent = {
  type: "AMOUNT_FILTER";
  depositMin?: number;
  depositMax?: number;
  withdrawalMin?: number;
  withdrawalMax?: number;
};
type DateResetEvent = { type: "DATE_RESET" };
type AmountResetEvent = { type: "AMOUNT_RESET" };
type FilterEvents =
  { type: "NONE" } | DateFilterEvent | AmountFilterEvent | DateResetEvent | AmountResetEvent;

export interface FilterContext {}

export const transactionFiltersMachine = Machine<FilterContext, FilterSchema, FilterEvents>(
  {
    id: "filters",
    type: "parallel",
    context: {},
    states: {
      dateRange: {
        initial: "none",
        states: {
          none: {
            entry: "resetDateRange",
            on: {
              DATE_FILTER: "filter",
            },
          },
          filter: {
            entry: "setDateRange",
            on: {
              DATE_RESET: "none",
              DATE_FILTER: "filter",
            },
          },
        },
      },
      amountRange: {
        initial: "none",
        states: {
          none: {
            entry: "resetAmountRange",
            on: {
              AMOUNT_FILTER: "filter",
            },
          },
          filter: {
            entry: "setAmountRange",
            on: {
              AMOUNT_RESET: "none",
              AMOUNT_FILTER: "filter",
            },
          },
        },
      },
    },
  },
  {
    actions: {
      setDateRange: assign((ctx: FilterContext, event: any) => ({
        dateRangeStart: event.dateRangeStart,
        dateRangeEnd: event.dateRangeEnd,
      })),
      resetDateRange: assign((ctx: FilterContext, event: any) => ({
        dateRangeStart: undefined,
        dateRangeEnd: undefined,
      })),
      setAmountRange: assign((ctx: FilterContext, event: any) => ({
        depositMin: event.depositMin,
        depositMax: event.depositMax,
        withdrawalMin: event.withdrawalMin,
        withdrawalMax: event.withdrawalMax,
      })),
      resetAmountRange: assign((ctx: FilterContext, event: any) => ({
        depositMin: undefined,
        depositMax: undefined,
        withdrawalMin: undefined,
        withdrawalMax: undefined,
      })),
    },
  }
);
