import { type ReactNode, useEffect, useId, useRef } from "react";
import { useMotion } from "~/lib/motion";

/**
 * A modal for decisions that must not be missed (ending sessions, replacing recovery codes,
 * confirming the password, the idle warning). Built on the native <dialog>: showModal() gives
 * the focus trap, the inert page, and Escape; focus returns to the opener when it closes.
 * Escape never acts on its own: it calls `onClose`, the safe choice. A click outside does
 * nothing, so a decision is never dismissed by accident. When the content advances a step
 * (`focusKey`), the new step slides in a few pixels from the reading direction (GSAP, skipped
 * under reduced motion), so the change of question is seen, not only announced.
 */
export function Dialog({
  open,
  title,
  description,
  children,
  actions,
  onClose,
  role = "dialog",
  focusKey,
}: {
  open: boolean;
  /** When this changes while open (the dialog advanced a step), focus moves again. */
  focusKey?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  /** `alertdialog` for warnings that interrupt (the idle warning). */
  role?: "dialog" | "alertdialog";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;

    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      opener.current = document.activeElement;

      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }

      // The safe choice (or the field to fill) takes focus, not simply the first button.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }

      if (opener.current instanceof HTMLElement && opener.current.isConnected) {
        opener.current.focus();
      }
    }
  }, [open]);

  // The previous render's state, read by the motion below before this effect updates it: only
  // a step change inside an open dialog slides (opening has its own CSS rise).
  const body = useRef<HTMLDivElement>(null);
  const previous = useRef({ open, focusKey });

  useMotion(
    ({ gsap }) => {
      const before = previous.current;

      if (open && before.open && before.focusKey !== focusKey && body.current !== null) {
        gsap.from(body.current, { x: 14, opacity: 0, duration: 0.32 });
      }
    },
    { dependencies: [open, focusKey] },
  );

  useEffect(() => {
    previous.current = { open, focusKey };
  }, [open, focusKey]);

  // A dialog that advances keeps its place in the page; its new step takes focus.
  const lastKey = useRef(focusKey);

  useEffect(() => {
    if (open && focusKey !== lastKey.current) {
      ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }

    lastKey.current = focusKey;
  }, [open, focusKey]);

  return (
    <dialog
      ref={ref}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="dialog-panel"
    >
      {open ? (
        <div ref={body} className="grid gap-4 p-6 sm:p-7">
          <h2 id={titleId} className="text-section font-wide">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="text-[0.9375rem] text-ink-muted">
              {description}
            </div>
          ) : null}
          {children}
          <div className="mt-2 flex flex-wrap justify-end gap-3">{actions}</div>
        </div>
      ) : null}
    </dialog>
  );
}
