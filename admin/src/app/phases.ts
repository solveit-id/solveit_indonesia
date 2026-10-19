/**
 * Build phases of the admin console, as recorded in .ai/project-status.md and
 * docs/architecture/admin-dashboard.md section 9. Status is a fact, not a translation; the
 * titles and details per language are in src/i18n/messages/. Update both when a phase moves.
 *
 * `released`: merged to main, not deployed (no phase is deployed). `current`: being built on
 * the `admin` branch. `planned`: not started.
 */
export type PhaseStatus = "released" | "current" | "planned";

export type PhaseCode = "b31a" | "b31b" | "b32a" | "b32b" | "b32c" | "b32d" | "b4a" | "b4b";

export interface Phase {
  code: PhaseCode;
  label: string;
  status: PhaseStatus;
}

export const phases: Phase[] = [
  { code: "b31a", label: "B3.1a", status: "released" },
  { code: "b31b", label: "B3.1b", status: "released" },
  { code: "b32a", label: "B3.2a", status: "released" },
  { code: "b32b", label: "B3.2b", status: "released" },
  { code: "b32c", label: "B3.2c", status: "released" },
  { code: "b32d", label: "B3.2d", status: "released" },
  { code: "b4a", label: "B4a", status: "released" },
  { code: "b4b", label: "B4b", status: "current" },
];
