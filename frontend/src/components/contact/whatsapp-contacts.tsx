import { useEffect, useId, useRef } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { company } from "~/data/company";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { whatsappUrl } from "~/services/inquiry";

/**
 * The three confirmed WhatsApp numbers, presented one way everywhere: one
 * clear entry point, then an equal choice between numbers. Nothing is said
 * about who answers which number, because that is not confirmed.
 */

function NumberRows({ onPick }: { onPick?: () => void }) {
  const { t } = useI18n();
  return (
    <ul className="grid gap-1">
      {company.whatsapp.map((number, index) => (
        <li key={number.e164}>
          <a
            href={whatsappUrl(number.e164, t.whatsapp.greeting)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onPick}
            className="wa-row group/row"
          >
            <span aria-hidden className="wa-row-index">
              {index + 1}
            </span>
            <span className="font-semibold tracking-[0.01em] text-ink">
              <span className="sr-only">{t.whatsapp.chatPrefix} </span>
              {number.display}
            </span>
            <ArrowUpRight
              aria-hidden
              weight="bold"
              className="ml-auto size-4 shrink-0 text-ink-muted transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/row:translate-x-0.5 group-hover/row:-translate-y-0.5 group-hover/row:text-accent-text"
            />
            <span className="sr-only"> {t.common.newTab}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

interface WhatsAppMenuProps {
  /** Trigger style: on porcelain, on the cobalt field, or as an inline footer link. */
  tone?: "paper" | "field" | "link";
  /** Which side the panel opens toward. */
  placement?: "bottom" | "top";
  align?: "start" | "end";
  className?: string;
}

/**
 * One "Chat WhatsApp" control that discloses the three numbers. Built on
 * <details>, so it opens before hydration and without JavaScript; once
 * hydrated it also closes on Escape, on an outside click, and after a pick.
 */
export function WhatsAppMenu({
  tone = "paper",
  placement = "bottom",
  align = "start",
  className,
}: WhatsAppMenuProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDetailsElement>(null);
  const titleId = useId();

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = (restoreFocus: boolean) => {
      if (!details.open) return;
      details.open = false;
      if (restoreFocus) details.querySelector("summary")?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!details.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.open) {
        event.stopPropagation();
        close(true);
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget && !details.contains(event.relatedTarget as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    details.addEventListener("keydown", onKeyDown);
    details.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      details.removeEventListener("keydown", onKeyDown);
      details.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <details ref={ref} className={cn("wa-menu group/wa relative", className)} data-wa-menu>
      <summary
        className={cn(
          tone === "paper" && "btn btn-secondary",
          tone === "field" && "btn btn-field-outline",
          tone === "link" && "inline-flex cursor-pointer items-center gap-1.5 link-sweep",
        )}
      >
        <WhatsappLogo aria-hidden weight="bold" className={tone === "link" ? "size-4" : "size-5"} />
        {t.whatsapp.trigger}
        <CaretDown
          aria-hidden
          weight="bold"
          className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-open/wa:rotate-180"
        />
      </summary>
      <div
        role="group"
        aria-labelledby={titleId}
        className={cn(
          "wa-panel",
          placement === "top" ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        <p id={titleId} className="px-3 pt-2 pb-1 text-sm font-semibold text-ink">
          {t.whatsapp.panelTitle}
        </p>
        <NumberRows onPick={() => ref.current && (ref.current.open = false)} />
        <p className="px-3 pt-1 pb-2 text-[0.8125rem] text-ink-muted">{t.whatsapp.panelNote}</p>
      </div>
    </details>
  );
}

/** The numbers laid out in full, for the contact page. */
export function WhatsAppList({ className }: { className?: string }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-[var(--radius-field)] border border-line bg-paper-raised p-2",
        className,
      )}
    >
      <h3 id={titleId} className="flex items-center gap-2.5 px-3 pt-3 pb-2 text-base font-semibold">
        <WhatsappLogo aria-hidden weight="bold" className="size-5 text-accent-text" />
        WhatsApp
      </h3>
      <NumberRows />
      <p className="px-3 pt-1 pb-3 text-[0.8125rem] text-ink-muted">{t.whatsapp.panelNote}</p>
    </section>
  );
}
