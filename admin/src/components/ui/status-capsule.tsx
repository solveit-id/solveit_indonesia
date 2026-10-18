import type { PhaseStatus } from "~/app/phases";
import { cn } from "~/lib/cn";
import type {
  AdminAccessLinkStatus,
  AdminAccountStatus,
} from "~/services/admin-api/owner-contracts";

/**
 * The tones of the 33 degree logo capsule. The three phase tones (filled released, half
 * current, dashed planned) come from B3.2a; B3.2c adds `stopped` (suspended, refused: danger),
 * `ended` (expired, revoked: hollow strong hairline), and `outline` (routine: accent outline).
 */
export type GlyphTone = PhaseStatus | "stopped" | "ended" | "outline";

const glyphClass: Record<GlyphTone, string | null> = {
  released: "phase-glyph-done",
  current: "phase-glyph-current",
  planned: "phase-glyph-planned",
  stopped: "phase-glyph-stopped",
  ended: "phase-glyph-ended",
  outline: null,
};

/** Account states as capsule tones: can sign in, in progress, not yet, stopped. */
export const accountTone: Record<AdminAccountStatus, GlyphTone> = {
  active: "released",
  "credential-reset-pending": "current",
  pending: "planned",
  suspended: "stopped",
};

/** Link states as capsule tones: accepted, enrolling, waiting, and the two ends. */
export const linkTone: Record<AdminAccessLinkStatus, GlyphTone> = {
  completed: "released",
  redeemed: "current",
  pending: "planned",
  expired: "ended",
  revoked: "ended",
};

/** The 33 degree logo capsule that marks a status. Decorative: always paired with words. */
export function PhaseGlyph({ status, className }: { status: GlyphTone; className?: string }) {
  return <span aria-hidden className={cn("phase-glyph", glyphClass[status], className)} />;
}

/**
 * A status written out, never a control: outlined capsule, glyph, label. Planned states use the
 * dashed outline, the system's "not yet" signifier (docs/DESIGN.md, Demo label).
 */
export function StatusCapsule({
  status,
  label,
  glyph = true,
  className,
}: {
  status: GlyphTone;
  label: string;
  /** Off where a glyph already marks the row (the phase track's spine), so it never doubles. */
  glyph?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-meta font-medium whitespace-nowrap",
        status === "planned"
          ? "border-dashed border-line-strong text-ink-muted"
          : status === "stopped"
            ? "border-danger/40 text-danger"
            : "border-line-strong text-ink",
        className,
      )}
    >
      {glyph ? <PhaseGlyph status={status} className="scale-75" /> : null}
      {label}
    </span>
  );
}
