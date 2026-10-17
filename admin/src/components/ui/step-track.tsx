import { useI18n } from "~/i18n/i18n";
import { cn } from "~/lib/cn";
import { PhaseGlyph } from "./status-capsule";

/**
 * Where a multi-step flow stands (sign-in, activation), drawn with the console's signature: the
 * logo capsule on the 33 degree axis, filled for a finished step, half for the current one,
 * hollow and dashed for what follows, joined by one hairline. The state is also written for
 * assistive technology, and the current step carries aria-current.
 */
export function StepTrack({
  label,
  steps,
  current,
}: {
  label: string;
  steps: string[];
  /** Index of the current step; `steps.length` when all are done. */
  current: number;
}) {
  const { t } = useI18n();

  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-2.5 gap-y-2 sm:gap-x-3">
      {steps.map((step, index) => {
        const status = index < current ? "released" : index === current ? "current" : "planned";

        return (
          <li
            key={step}
            aria-current={index === current ? "step" : undefined}
            className="flex items-center gap-3"
          >
            {index > 0 ? <span aria-hidden className="h-px w-4 bg-line-strong sm:w-5" /> : null}
            <span className="inline-flex items-center gap-2">
              <PhaseGlyph status={status} className="scale-75" />
              {/* Below 640px the labels give way to "Step 3 of 4" beside the current glyph, so the
                  track stays one line; the page heading names the step, and every label
                  remains for assistive technology. */}
              {index === current ? (
                <span aria-hidden className="text-meta font-semibold text-ink sm:hidden">
                  {t.common.stepOf(index + 1, steps.length)}
                </span>
              ) : null}
              <span
                className={cn(
                  "text-meta max-sm:sr-only",
                  index === current ? "font-semibold text-ink" : "text-ink-muted",
                )}
              >
                {step}
              </span>
              <span className="sr-only">
                {", "}
                {index < current
                  ? t.common.stepDone
                  : index === current
                    ? t.common.stepCurrent
                    : t.common.stepNext}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
