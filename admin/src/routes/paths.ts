/** Route paths of the console. Only screens that really exist get a path. */
export const paths = {
  home: "/",
  signIn: "/masuk",
  /** Fixed by the backend (config/admin.php `access_links.path`): links are built with it. */
  access: "/access",
  account: "/akun",
  security: "/akun/keamanan",
  /** Owner administration (B3.2c). */
  users: "/pengguna",
  invitations: "/undangan",
  invite: "/undangan/baru",
  audit: "/audit",
  /** Inquiry handling (B4b), owner and admin. */
  inquiries: "/inquiry",
} as const;

/** One account's detail screen. */
export const userPath = (id: number): string => `${paths.users}/${id}`;

/** One inquiry's detail screen: the internal ID only, never a name or contact in the address. */
export const inquiryPath = (id: number): string => `${paths.inquiries}/${id}`;

/** `/pengguna/<id>`: a positive integer of at most ten digits, nothing else. */
export const USER_PATH = /^\/pengguna\/([1-9][0-9]{0,9})$/;

/** `/inquiry/<id>`: the same rule. */
export const INQUIRY_PATH = /^\/inquiry\/([1-9][0-9]{0,9})$/;

/** The account ID of a detail path, or null when the path is not exactly one. */
export function userIdFromPath(pathname: string): number | null {
  const match = USER_PATH.exec(pathname);

  return match ? Number(match[1]) : null;
}

/** The inquiry ID of a detail path, or null when the path is not exactly one. */
export function inquiryIdFromPath(pathname: string): number | null {
  const match = INQUIRY_PATH.exec(pathname);

  return match ? Number(match[1]) : null;
}

/** Screens behind sign-in; with the detail patterns, the only places a sign-in may return to. */
export const privatePaths: ReadonlySet<string> = new Set([
  paths.home,
  paths.account,
  paths.security,
  paths.users,
  paths.invitations,
  paths.invite,
  paths.audit,
  paths.inquiries,
]);

/** Development and QA builds only; unused, and therefore dropped, in production builds. */
export const referencePath = "/referensi-komponen";

/**
 * The component reference exists on the dev server and in the CI reference build
 * (`vite build --mode reference`) only. Code tests the global `__ADMIN_COMPONENT_REFERENCE__`
 * directly (src/app/router.tsx, primary-navigation.tsx): vite.config.ts `define` writes the
 * literal in at each use, so production builds drop the route, its link, and its chunk
 * (scripts/check-build.mjs verifies it). Declared in src/env.d.ts.
 */
