import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { type ReactNode, type SelectHTMLAttributes, useId } from "react";
import { cn } from "~/lib/cn";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}

/**
 * Labelled native select in the field capsule, with the caret in a sunken well that turns
 * cobalt on focus (docs/DESIGN.md, Inputs, Select). Native everywhere: keyboard, screen-reader,
 * and phone pickers come from the browser.
 */
export function SelectField({ label, hint, className, children, ...props }: SelectFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          {...props}
          id={id}
          aria-describedby={hint ? hintId : undefined}
          className="peer field-input field-select"
        >
          {children}
        </select>
        <span
          aria-hidden
          className="select-caret peer-focus-visible:bg-accent peer-focus-visible:text-accent-ink"
        >
          <CaretDown size={16} weight="bold" />
        </span>
      </div>
      {hint ? (
        <p id={hintId} className="text-meta text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
