import { type ReactNode, useId } from "react";
import { cn } from "~/lib/cn";

interface PanelProps {
  title: string;
  /** Heading level inside the page outline. */
  level?: 2 | 3;
  children: ReactNode;
  className?: string;
}

/**
 * A titled container: raised porcelain, hairline, 28px panel radius, no shadow (the Tone Not
 * Shadow rule). The section is named by its heading for assistive technology.
 */
export function Panel({ title, level = 2, children, className }: PanelProps) {
  const Heading = level === 2 ? "h2" : "h3";
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-panel border border-line bg-paper-raised p-6 sm:p-7", className)}
    >
      <Heading id={headingId} className="text-section font-wide">
        {title}
      </Heading>
      <div className="mt-3">{children}</div>
    </section>
  );
}
