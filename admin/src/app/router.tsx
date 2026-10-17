import { Outlet, type RouteObject, createBrowserRouter } from "react-router";
import { requireAccount, signInLoader } from "~/auth/guards";
import { PRIVATE_ROUTE_ID } from "~/auth/use-account";
import { AppShell } from "~/components/layout/app-shell";
import { PrivateLayout, PrivateRouteError } from "./private-layout";
import { PublicLayout, RootLayout } from "./root-layout";
import { RootError, RouteError, ShellFallback } from "./route-error";
import type { RouteHandle } from "./route-handle";

/**
 * React Router 7 in data mode (no framework mode: it would inline scripts and complicate the
 * strict CSP, docs/architecture/admin-dashboard.md section 2). Every page is a lazy chunk. Only
 * screens that really exist are routed; everything else is the honest 404.
 *
 * Two areas. Public (`/masuk`, `/access`, the 404) in the auth frame, without an account.
 * Private (`/`, `/akun`, `/akun/keamanan`) behind `requireAccount`, which runs `GET me` on every
 * navigation into or inside it before anything renders (src/auth/guards.ts).
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RootError,
    HydrateFallback: ShellFallback,
    children: [
      {
        Component: PublicLayout,
        children: [
          {
            ErrorBoundary: RouteError,
            children: [
              {
                path: "masuk",
                loader: signInLoader,
                HydrateFallback: ShellFallback,
                handle: { title: (t) => t.signIn.title } satisfies RouteHandle,
                lazy: async () => ({ Component: (await import("~/pages/sign-in")).SignIn }),
              },
              {
                path: "access",
                handle: { title: (t) => t.access.pageTitle } satisfies RouteHandle,
                lazy: async () => ({ Component: (await import("~/pages/access")).Access }),
              },
              {
                path: "*",
                handle: { title: (t) => t.notFound.title } satisfies RouteHandle,
                lazy: async () => ({ Component: (await import("~/pages/not-found")).NotFound }),
              },
            ],
          },
        ],
      },
      {
        id: PRIVATE_ROUTE_ID,
        loader: requireAccount,
        // Every navigation re-verifies the session with Laravel: Back after signing out, an
        // idle or revoked session, and a reset account never show a stale view.
        shouldRevalidate: () => true,
        Component: PrivateLayout,
        ErrorBoundary: PrivateRouteError,
        HydrateFallback: ShellFallback,
        children: [
          {
            // Pathless: errors inside a page keep the shell and its navigation.
            ErrorBoundary: RouteError,
            children: [
              {
                index: true,
                handle: { title: (t) => t.home.title } satisfies RouteHandle,
                lazy: async () => ({ Component: (await import("~/pages/home")).Home }),
              },
              {
                path: "akun",
                handle: { title: (t) => t.account.title } satisfies RouteHandle,
                lazy: async () => ({ Component: (await import("~/pages/account")).Account }),
              },
              {
                path: "akun/keamanan",
                handle: { title: (t) => t.security.title } satisfies RouteHandle,
                lazy: async () => ({ Component: (await import("~/pages/security")).Security }),
              },
            ],
          },
        ],
      },
      ...(__ADMIN_COMPONENT_REFERENCE__
        ? [
            {
              // Development and QA only: sample components, no account and no data.
              Component: () => (
                <AppShell>
                  <Outlet />
                </AppShell>
              ),
              children: [
                {
                  path: "referensi-komponen",
                  ErrorBoundary: RouteError,
                  handle: { title: (t) => t.nav.reference } satisfies RouteHandle,
                  lazy: async () => ({
                    Component: (await import("~/pages/component-reference")).ComponentReference,
                  }),
                },
              ],
            } satisfies RouteObject,
          ]
        : []),
    ],
  },
];

export const createAdminRouter = () => createBrowserRouter(routes);
