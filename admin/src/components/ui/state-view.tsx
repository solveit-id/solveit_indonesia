import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import type { ReactNode } from "react";
import { Button } from "./button";

/**
 * The three states every data view owes (docs/architecture/admin-dashboard.md section 7):
 * loading as fixed-size skeletons (no layout jump), empty that explains what will appear and
 * why, and failure that says what happened and offers the next step without technical detail.
 */
/** Fixed widths, so a loading view never shifts; classes rather than inline styles (CSP). */
const skeletonWidths = ["w-[88%]", "w-[71%]", "w-[54%]", "w-[37%]"];

export function LoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">{label}</span>
      {skeletonWidths.slice(0, rows).map((width) => (
        <span key={width} aria-hidden className={`skeleton h-4 ${width}`} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-line-strong px-5 py-6">
      <p className="text-item font-semibold font-wide">{title}</p>
      <p className="mt-1.5 max-w-[56ch] text-ink-muted">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  children,
  retryLabel,
  onRetry,
}: {
  title: string;
  children: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-[1.25rem] border border-danger/40 bg-[var(--danger-soft)] px-5 py-5"
    >
      <p className="flex items-center gap-2 font-semibold text-danger">
        <WarningCircle aria-hidden size={20} weight="bold" />
        {title}
      </p>
      <p className="mt-1.5 max-w-[56ch] text-ink">{children}</p>
      {onRetry && retryLabel ? (
        <Button className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
