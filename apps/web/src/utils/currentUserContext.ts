import React from "react";

/**
 * The id of the signed-in user, for components deep in the page (for example the amount of a
 * transaction, which is shown as + or - from this user's point of view).
 * It is provided once, in PrivateRoutesContainer.
 */
export const CurrentUserIdContext = React.createContext<string | undefined>(undefined);
