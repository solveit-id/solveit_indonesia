import { type InputHTMLAttributes, useId } from "react";
import { cn } from "~/lib/cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * Labelled single-line input. Hint and error are wired with aria-describedby; an error also
 * sets aria-invalid and is announced. Paste is never blocked (WCAG 3.3.8).
 */
export function TextField({ label, hint, error, className, ...props }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="field-input"
      />
      {hint ? (
        <p id={hintId} className="text-meta text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-meta font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
