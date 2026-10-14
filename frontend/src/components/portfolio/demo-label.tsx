import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";

/**
 * Marks illustrative concepts so they are never read as client work. A
 * status, not a control: a dashed capsule (the system's "not yet" signifier)
 * with a hollow logo capsule on the 33deg axis, an outline of a part that has
 * not been built. The lead phrase carries the weight; the qualifier after the
 * comma stays legible in muted ink. It has no hover, no pointer, and no
 * button height, so it never reads as something to press.
 */
export function DemoLabel({ className, label }: { className?: string; label?: string }) {
  const { t } = useI18n();
  const text = label ?? t.common.demoLabel;
  const split = text.indexOf(",");
  const lead = split > 0 ? text.slice(0, split + 1) : text;
  const rest = split > 0 ? text.slice(split + 1).trim() : "";
  return (
    <p className={cn("demo-label", className)}>
      <span aria-hidden className="demo-label-glyph" />
      <span className="demo-label-text">
        <span className="demo-label-lead">{lead}</span>
        {rest && (
          <>
            {" "}
            <span className="demo-label-rest">{rest}</span>
          </>
        )}
      </span>
    </p>
  );
}
