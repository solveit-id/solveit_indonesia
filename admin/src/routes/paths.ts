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
} as const;

/** One account's detail screen. */
export const userPath = (id: number): string => `${paths.users}/${id}`;

/** `/pengguna/<id>`: a positive integer of at most ten digits, nothing else. */
export const USER_PATH = /^\/pengguna\/([1-9][0-9]{0,9})$/;

/** The account ID of a detail path, or null when the path is not exactly one. */
export function userIdFromPath(pathname: string): number | null {
  const match = USER_PATH.exec(pathname);

  return match ? Number(match[1]) : null;
}

/** Screens behind sign-in; with the detail pattern, the only places a sign-in may return to. */
export const privatePaths: ReadonlySet<string> = new Set([
  paths.home,
  paths.account,
  paths.security,
  paths.users,
  paths.invitations,
  paths.invite,
  paths.audit,
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
