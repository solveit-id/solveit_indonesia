import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  quiet: "btn-quiet",
  danger: "btn-danger",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** While true the button is announced as busy, cannot be pressed again, and shows `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  icon?: ReactNode;
}

/**
 * The console's only button. Busy is not disabled-looking: the label changes and a short
 * capsule runs on the 33 degree axis, so a pending action never reads as unavailable.
 */
export function Button({
  variant = "secondary",
  busy = false,
  busyLabel,
  icon,
  className,
  children,
  disabled,
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || props["aria-disabled"] || undefined}
      onClick={busy ? undefined : onClick}
      className={cn("btn", variantClass[variant], className)}
    >
      {busy ? <BusyCapsule /> : icon}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
}

function BusyCapsule() {
  return (
    <span aria-hidden className="inline-flex size-4 items-center justify-center">
      <span className="busy-track">
        <span className="busy-capsule" />
      </span>
    </span>
  );
}
