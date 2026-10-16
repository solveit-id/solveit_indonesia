import { type ReactNode, useId } from "react";
import { cn } from "~/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Spoken name when `label` is an abbreviation or an icon. */
  accessibleLabel?: string;
  lang?: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A capsule with one thumb per choice, built on native radio buttons: arrow keys, focus, and
 * the screen reader's "radio, 1 of 2" all come from the browser.
 */
export function SegmentedControl<T extends string>({
  legend,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="flex rounded-full border border-line-strong p-1">
        {options.map((option) => {
          const checked = option.value === value;

          return (
            <label
              key={option.value}
              lang={option.lang}
              className={cn(
                "relative flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-[0.875rem] font-semibold transition-colors duration-[var(--dur-state)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                checked ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                aria-label={option.accessibleLabel}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
