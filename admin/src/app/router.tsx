import { type RouteObject, createBrowserRouter } from "react-router";

import { RootLayout } from "./root-layout";
import { RootError, RouteError, ShellFallback } from "./route-error";
import type { RouteHandle } from "./route-handle";

/**
 * React Router 7 in data mode (no framework mode: it would inline scripts and complicate the
 * strict CSP, docs/architecture/admin-dashboard.md section 2). Every page is a lazy chunk. Only
 * screens that really exist are routed; everything else is the honest 404.
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RootError,
    HydrateFallback: ShellFallback,
    children: [
      {
        // Pathless: errors inside a page keep the shell and its navigation.
        ErrorBoundary: RouteError,
        children: [
          {
            index: true,
            handle: { title: (t) => t.foundation.title } satisfies RouteHandle,
            lazy: async () => ({
              Component: (await import("~/pages/foundation-overview")).FoundationOverview,
            }),
          },
          ...(__ADMIN_COMPONENT_REFERENCE__
            ? [
                {
                  path: "referensi-komponen",
                  handle: { title: (t) => t.nav.reference } satisfies RouteHandle,
                  lazy: async () => ({
                    Component: (await import("~/pages/component-reference")).ComponentReference,
                  }),
                },
              ]
            : []),
          {
            path: "*",
            handle: { title: (t) => t.notFound.title } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import("~/pages/not-found")).NotFound }),
          },
        ],
      },
    ],
  },
];

export const createAdminRouter = () => createBrowserRouter(routes);
