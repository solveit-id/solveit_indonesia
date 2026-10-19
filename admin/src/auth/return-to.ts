import { inquiryIdFromPath, paths, privatePaths, userIdFromPath } from "~/routes/paths";

/**
 * Where sign-in sends the person afterwards. The value arrives in the address bar
 * (`/masuk?kembali=...`), so anyone can write it: it is accepted only when it names one of the
 * console's own private screens, exactly, or one account's or inquiry's detail
 * (`/pengguna/<id>`, `/inquiry/<id>`, digits only). Anything else (another origin, `//host`, a scheme, backslashes, control characters,
 * encoded tricks, the access page, unknown paths) falls back to the home screen. Query and
 * fragment are dropped.
 */
// Only a base for parsing; nothing is requested. An absolute or protocol-relative value parses
// to another origin and is refused.
const PROBE_ORIGIN = "http://localhost";

export function safeReturnTo(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return paths.home;
  }

  // Backslashes and control characters are refused outright: browsers treat "\" like "/".
  const unsafe = [...value].some((character) => {
    const code = character.charCodeAt(0);

    return character === "\\" || code < 0x20 || code === 0x7f;
  });

  if (unsafe) {
    return paths.home;
  }

  let url: URL;

  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return paths.home;
  }

  if (url.origin !== PROBE_ORIGIN) {
    return paths.home;
  }

  return privatePaths.has(url.pathname) ||
    userIdFromPath(url.pathname) !== null ||
    inquiryIdFromPath(url.pathname) !== null
    ? url.pathname
    : paths.home;
}

/** Why the person sees the sign-in screen; written into the address bar as a fixed word. */
export type SignInNotice = "expired" | "signed-out" | "elsewhere";

const noticeWords: Record<SignInNotice, string> = {
  expired: "berakhir",
  "signed-out": "keluar",
  elsewhere: "tempat-lain",
};

export function readSignInNotice(value: string | null): SignInNotice | null {
  const entry = Object.entries(noticeWords).find(([, word]) => word === value);

  return entry ? (entry[0] as SignInNotice) : null;
}

/** `/masuk`, with a safe return path (omitted for home) and an optional notice. */
export function signInPath({
  returnTo,
  notice,
}: { returnTo?: string | undefined; notice?: SignInNotice | undefined } = {}): string {
  const search = new URLSearchParams();
  const target = safeReturnTo(returnTo);

  if (target !== paths.home) {
    search.set("kembali", target);
  }

  if (notice) {
    search.set("alasan", noticeWords[notice]);
  }

  const query = search.toString();

  return query === "" ? paths.signIn : `${paths.signIn}?${query}`;
}
