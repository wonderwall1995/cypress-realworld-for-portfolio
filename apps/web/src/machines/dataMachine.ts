import { Machine, assign } from "xstate";
import { concat } from "lodash/fp";

export interface DataSchema {
  states: {
    idle: {};
    loading: {};
    updating: {};
    creating: {};
    deleting: {};
    success: {
      states: {
        unknown: {};
        withData: {};
        withoutData: {};
      };
    };
    failure: {};
  };
}

type SuccessEvent = { type: "SUCCESS"; results: any[]; pageData: object };
type FailureEvent = { type: "FAILURE"; message: string };
export type DataEvents =
  | { type: "FETCH" }
  | { type: "UPDATE" }
  | { type: "CREATE" }
  | { type: "DELETE" }
  | SuccessEvent
  | FailureEvent;

export interface DataContext {
  pageData?: object;
  results?: any[];
  message?: string;
}

export const dataMachine = (machineId: string) =>
  Machine<DataContext, DataSchema, DataEvents>(
    {
      id: machineId,
      initial: "idle",
      context: {
        pageData: {},
        results: [],
        message: undefined,
      },
      states: {
        idle: {
          on: {
            FETCH: "loading",
            CREATE: "creating",
            UPDATE: "updating",
            DELETE: "deleting",
          },
        },
        loading: {
          invoke: {
            src: "fetchData",
            onDone: { target: "success" },
            onError: { target: "failure", actions: "setMessage" },
          },
          on: {
            // a press while the list is being read again must not be lost: it is saved first, then the list is read
            UPDATE: "updating",
            // a new question (for example another filter) while the answer before it is on its way: that answer is
            // dropped and the new one is read. Otherwise the list would stay on the older filter.
            FETCH: { target: "loading", cond: "isNewList" },
          },
        },
        updating: {
          invoke: {
            src: "updateData",
            onDone: { target: "loading" },
            onError: { target: "failure", actions: "setMessage" },
          },
          // the same for a second press while the first one is being saved (both are saved)
          on: {
            UPDATE: "updating",
          },
        },
        creating: {
          invoke: {
            src: "createData",
            onDone: { target: "loading" },
            onError: { target: "failure", actions: "setMessage" },
          },
        },
        deleting: {
          invoke: {
            src: "deleteData",
            onDone: { target: "loading" },
            onError: { target: "failure", actions: "setMessage" },
          },
        },
        success: {
          entry: ["setResults", "setPageData"],
          on: {
            FETCH: "loading",
            CREATE: "creating",
            UPDATE: "updating",
            DELETE: "deleting",
          },
          initial: "unknown",
          states: {
            unknown: {
              on: {
                "": [{ target: "withData", cond: "hasData" }, { target: "withoutData" }],
              },
            },
            withData: {},
            withoutData: {},
          },
        },
        failure: {
          entry: ["setMessage"],
          on: {
            FETCH: "loading",
          },
        },
      },
    },
    {
      actions: {
        setResults: assign((ctx: DataContext, event: any) => ({
          results:
            event.data && event.data.pageData && event.data.pageData.page > 1
              ? concat(ctx.results, event.data.results)
              : event.data.results,
        })),
        setPageData: assign((ctx: DataContext, event: any) => ({
          pageData: event.data.pageData,
        })),

        setMessage: /* istanbul ignore next */ assign((ctx, event: any) => ({
          message: event.message,
        })),
      },
      guards: {
        // the next page of a list belongs to the list that is there: it does not replace a reading that is on its way
        isNewList: (ctx: DataContext, event: any) => !(event.page > 1),
        hasData: (ctx: DataContext, event) => !!ctx.results && ctx.results.length > 0,
      },
    }
  );
