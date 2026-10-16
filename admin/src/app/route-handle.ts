import type { Messages } from "~/i18n/messages/id";

/** Route metadata (`handle`): the page title, in the current language. */
export interface RouteHandle {
  title: (t: Messages) => string;
}

export const isRouteHandle = (value: unknown): value is RouteHandle =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Partial<RouteHandle>).title === "function";
