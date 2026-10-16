import type { Messages } from "./id";

/** Interface copy, English. Same structure as id.ts, written for an English-reading admin. */
export const en: Messages = {
  meta: {
    product: "Admin console",
    owner: "Solveit Indonesia",
  },
  shell: {
    skipToContent: "Skip to content",
    consoleName: "Admin console",
    environmentLead: "B3.2a foundation",
    environmentDetail: "not for production",
    navigation: "Main navigation",
    openMenu: "Menu",
    loadingRoute: "Loading page",
  },
  nav: {
    foundation: "Foundation overview",
    reference: "Component reference",
  },
  theme: {
    label: "Theme",
    toDark: "Switch to dark theme",
    toLight: "Switch to light theme",
    light: "Light",
    dark: "Dark",
  },
  locale: {
    label: "Language",
    id: "Indonesia",
    en: "English",
  },
  foundation: {
    title: "Admin console foundation",
    lede: "The application frame, design system, and API client for managing the Solveit website. There is no sign-in and no data yet: both arrive once their flows are built and tested.",
    phasesTitle: "Build phases",
    phasesIntro:
      "The admin API is released to main but not deployed anywhere. This console follows phase by phase.",
    phaseStatus: {
      released: "Released, not deployed",
      current: "In progress",
      planned: "Planned",
    },
    phases: {
      b31a: {
        title: "Backend identity",
        detail:
          "Single-use access links, mandatory TOTP, database sessions, owner and admin roles, append-only audit log.",
      },
      b31b: {
        title: "User administration and audit (API)",
        detail:
          "Invitations, role changes, suspension, credential resets, and owner-only audit reading.",
      },
      b32a: {
        title: "Console foundation",
        detail:
          "Application frame, design system shared with the website, API client with CSRF, native and Docker development, CI.",
      },
      b32b: {
        title: "Sign-in, activation, and recovery",
        detail:
          "Sign-in with password and TOTP, activation and reset through links, own account security.",
      },
      b32c: {
        title: "Administration workspace",
        detail: "Users, invitations, roles, suspension, and the audit log for owners.",
      },
      b32d: {
        title: "Private admin release",
        detail:
          "Production image, separate admin listener (loopback by default), security headers, smoke test.",
      },
    },
    connection: {
      title: "Admin API connection",
      body: "One real request, GET /api/v1/admin/auth/csrf-cookie, through the same-origin proxy. It starts an anonymous session and signs nobody in.",
      action: "Check connection",
      checking: "Checking connection",
      idle: "Not checked yet.",
      reachable: "The admin API answered (204). Host and origin match ADMIN_URL.",
      refused: (status: number, origin: string) =>
        `Refused by the admin boundary (${status}). The backend's ADMIN_URL must equal this origin: ${origin}.`,
      unavailable:
        "The admin API refuses to run (503): the backend session driver is not database.",
      rateLimited: (seconds: number | undefined) =>
        seconds === undefined
          ? "Checked too often. Try again shortly."
          : `Checked too often. Try again in ${seconds} seconds.`,
      unreachable:
        "Laravel is not answering. Start {command} in {path} or the Docker backend service, then check again.",
      unexpected: (status: number | null) =>
        `Unexpected answer${status === null ? "" : ` (${status})`}. Check the Laravel log.`,
      checkedAt: (time: string) => `Checked at ${time}`,
    },
  },
  notFound: {
    title: "Page not found",
    body: "This address does not exist in the admin console. Sign-in and administration are not built yet, so links to them do not work yet.",
    back: "Back to the overview",
  },
  error: {
    title: "The page failed to load",
    body: "Something went wrong in the console. Reload the page; if it keeps happening, note the time for investigation.",
    reload: "Reload",
    back: "Back to the overview",
  },
};
