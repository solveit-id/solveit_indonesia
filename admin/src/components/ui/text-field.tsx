import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react";
import { cn } from "~/lib/cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  /** A control inside the capsule's end, such as the password visibility toggle. */
  trailing?: ReactNode;
  /** Visually smaller field for codes and keys: monospace digits, wider tracking. */
  code?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Labelled single-line input. Hint and error are wired with aria-describedby; an error also
 * sets aria-invalid and is announced. Paste is never blocked (WCAG 3.3.8).
 */
export function TextField({
  label,
  hint,
  error,
  trailing,
  code = false,
  className,
  ref,
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn("field-input", trailing ? "pr-14" : null, code && "field-code")}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
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
