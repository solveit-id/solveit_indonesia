import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "~/i18n/i18n";
import { Button } from "./button";

/**
 * Copies a value to the clipboard only when pressed (never on its own), then says so in a polite
 * status message. When the browser refuses, it says how to copy by hand instead of pretending.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const reset = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(reset.current), []);

  const copy = async () => {
    window.clearTimeout(reset.current);

    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }

    reset.current = window.setTimeout(() => setState("idle"), 6000);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <Button
        onClick={copy}
        icon={
          state === "copied" ? (
            <Check aria-hidden size={18} weight="bold" />
          ) : (
            <Copy aria-hidden size={18} weight="bold" />
          )
        }
      >
        {label}
      </Button>
      <span role="status" className="text-meta text-ink-muted">
        {state === "copied" ? t.common.copied : state === "failed" ? t.common.copyFailed : ""}
      </span>
    </span>
  );
}
