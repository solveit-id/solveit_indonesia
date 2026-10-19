import { type ReactNode, type Ref, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "~/lib/cn";

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Labelled multi-line input (an inquiry note), the same contract as TextField: hint and error
 * wired with aria-describedby, an error sets aria-invalid and is announced, paste is never
 * blocked. Single-line fields are capsules; this one takes the field radius.
 */
export function TextAreaField({
  label,
  hint,
  error,
  className,
  ref,
  ...props
}: TextAreaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
      <textarea
        {...props}
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="field-input field-textarea"
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
