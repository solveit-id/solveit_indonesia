import type { PhaseStatus } from "~/app/phases";
import { cn } from "~/lib/cn";

const glyphClass: Record<PhaseStatus, string> = {
  released: "phase-glyph-done",
  current: "phase-glyph-current",
  planned: "phase-glyph-planned",
};

/** The 33 degree logo capsule that marks a status. Decorative: always paired with words. */
export function PhaseGlyph({ status, className }: { status: PhaseStatus; className?: string }) {
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
}: {
  status: PhaseStatus;
  label: string;
  /** Off where a glyph already marks the row (the phase track's spine), so it never doubles. */
  glyph?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-meta font-medium",
        status === "planned"
          ? "border-dashed border-line-strong text-ink-muted"
          : "border-line-strong text-ink",
      )}
    >
      {glyph ? <PhaseGlyph status={status} className="scale-75" /> : null}
      {label}
    </span>
  );
}
