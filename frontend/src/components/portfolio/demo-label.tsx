import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";

/** Marks illustrative concepts so they are never read as client work. */
export function DemoLabel({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-line-strong px-3 py-1 text-[0.8125rem] font-medium text-ink-muted",
        className,
      )}
    >
      {t.common.demoLabel}
    </p>
  );
}
