import { isEmpty, omit } from "lodash/fp";
import { dataMachine } from "./dataMachine";
import { httpClient } from "../utils/asyncUtils";
import { API_BASE } from "../utils/apiUtils";

// one save at a time: the list is read again only after the last one, so it never shows an older answer
let lastSave: Promise<unknown> = Promise.resolve();

export const notificationsMachine = dataMachine("notifications").withConfig({
  services: {
    fetchData: async (ctx, event: any) => {
      const payload = omit("type", event);
      const resp = await httpClient.get(`${API_BASE}/notifications`, {
        params: !isEmpty(payload) && event.type === "FETCH" ? payload : undefined,
      });
      return resp.data;
    },
    updateData: async (ctx, event: any) => {
      const payload = omit("type", event);
      const save = () => httpClient.patch(`${API_BASE}/notifications/${payload.id}`, payload);
      const saving = lastSave.then(save, save);
      lastSave = saving;
      return (await saving).data;
    },
  },
});
