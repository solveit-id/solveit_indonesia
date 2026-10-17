import { useRouteLoaderData } from "react-router";
import type { AdminAccount } from "~/services/admin-api";
import { useSessionState } from "./session";

/** Route id of the private layout, whose loader verifies the account (router.tsx). */
export const PRIVATE_ROUTE_ID = "private";

/**
 * The verified account inside the private area: the latest one Laravel returned (the session
 * store is refreshed after a password change, a regeneration, or "stay signed in"), else the
 * private loader's. Only private screens call it; outside them there is no account.
 */
export function useVerifiedAccount(): AdminAccount {
  const session = useSessionState();
  const loaded = useRouteLoaderData(PRIVATE_ROUTE_ID) as AdminAccount | undefined;

  if (session.status === "signed-in") {
    return session.account;
  }

  if (loaded === undefined) {
    throw new Error("useVerifiedAccount is used outside the private area.");
  }

  return loaded;
}
