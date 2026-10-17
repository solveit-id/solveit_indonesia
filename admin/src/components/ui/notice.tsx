import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import type { ReactNode, Ref } from "react";
import { cn } from "~/lib/cn";

export type NoticeTone = "info" | "success" | "warning" | "danger";

const toneClass: Record<NoticeTone, string> = {
  info: "border-line bg-paper-raised",
  success: "border-line-strong bg-paper-raised",
  // Solid and stronger than info. Dashed stays reserved for "not yet" (planned, demo).
  warning: "border-line-strong bg-paper-sunken",
  danger: "border-danger/40 bg-[var(--danger-soft)]",
};

/**
 * One message about the screen's state, inline where it applies. A danger notice is an alert
 * (announced at once); the others are polite status messages. The icon is decorative: the
 * words always carry the meaning.
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  ref,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  const Icon = tone === "danger" ? WarningCircle : tone === "success" ? CheckCircle : Info;

  return (
    <div
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-[1.25rem] border px-5 py-4 outline-none", toneClass[tone], className)}
    >
      <div className="flex gap-3">
        <Icon
          aria-hidden
          size={20}
          weight="bold"
          className={cn(
            "mt-0.5 flex-none",
            tone === "danger"
              ? "text-danger"
              : tone === "success"
                ? "text-accent-text"
                : "text-ink-muted",
          )}
        />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className={cn("font-semibold", tone === "danger" ? "text-danger" : "text-ink")}>
              {title}
            </p>
          ) : null}
          {children ? (
            <div className={cn("text-[0.9375rem] text-ink", title && "mt-1")}>{children}</div>
          ) : null}
          {action ? <div className="mt-3 flex flex-wrap gap-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
