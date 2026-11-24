import { omit, flow, first, isEmpty } from "lodash/fp";
import { dataMachine } from "./dataMachine";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";

export const transactionDetailMachine = dataMachine("transactionData").withConfig({
  services: {
    fetchData: async (ctx, event: any) => {
      const payload = omit("type", event);
      const contextTransactionId = !isEmpty(ctx.results) && first(ctx.results)["id"];
      // the transaction that is asked for; after a like or a comment nothing is asked: read the shown one again
      const transactionId = payload.transactionId || contextTransactionId;
      const resp = await httpClient.get(`${API_BASE}/transactions/${transactionId}`);
      // @ts-ignore
      return { results: [resp.data.transaction] };
    },
    createData: async (ctx, event: any) => {
      let route = event.entity === "LIKE" ? "likes" : "comments";
      const payload = flow(omit("type"), omit("entity"))(event);
      try {
        const resp = await httpClient.post(
          `${API_BASE}/${route}/${payload.transactionId}`,
          payload
        );
        return resp.data;
      } catch (error: any) {
        // 409: already liked (for example in another tab). 422: the text was refused.
        // Keep the screen: the machine reads the transaction again, so it shows what the server has.
        if ([409, 422].includes(error.response?.status)) return undefined;
        throw error;
      }
    },
  },
});
