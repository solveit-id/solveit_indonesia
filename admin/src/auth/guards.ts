import { type LoaderFunctionArgs, redirect } from "react-router";
import { type AdminAccount, accountApi, isAdminApiError } from "~/services/admin-api";
import { type SignInNotice, safeReturnTo, signInPath } from "./return-to";
import { type SessionState, getSessionState, markVerified } from "./session";

const noticeFor = (before: SessionState): SignInNotice | undefined => {
  if (before.status === "signed-in") {
    return "expired";
  }

  return before.status === "signed-out" && before.reason !== "signed-out"
    ? before.reason
    : undefined;
};

/**
 * Loader of every private screen. Nothing behind sign-in renders until Laravel has answered
 * `GET me` with an account: the router keeps the previous screen (or the blank start-up
 * fallback) while it waits. It runs on every navigation into or within the private area
 * (`shouldRevalidate` in router.tsx), so Back after signing out, an expired session, or a
 * revoked one never shows a stale account view.
 *
 * - 200: the account is stored in memory and returned to the layout.
 * - 401: to sign-in, keeping this screen as the (validated) return path.
 * - anything else (403, 429, 5xx, network, timeout): thrown to the private error boundary,
 *   which shows no account data. A server that cannot answer never counts as signed in.
 */
export async function requireAccount({ request }: LoaderFunctionArgs): Promise<AdminAccount> {
  const before = getSessionState();

  try {
    const verified = await accountApi.me(request.signal);
    markVerified(verified);

    return verified.account;
  } catch (error) {
    if (isAdminApiError(error) && error.kind === "unauthenticated") {
      const { pathname } = new URL(request.url);

      throw redirect(signInPath({ returnTo: pathname, notice: noticeFor(before) }));
    }

    throw error;
  }
}

/**
 * Loader of the sign-in screen: someone already signed in goes straight to where they were
 * heading. Every failure (401 above all, but also an unreachable server) simply shows the form;
 * the form itself reports what the server says.
 */
export async function signInLoader({ request }: LoaderFunctionArgs): Promise<null> {
  const url = new URL(request.url);

  try {
    markVerified(await accountApi.me(request.signal));
  } catch {
    return null;
  }

  throw redirect(safeReturnTo(url.searchParams.get("kembali")));
}
