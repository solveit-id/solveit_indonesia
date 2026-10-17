import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { useEffect, useId, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import { Dialog } from "~/components/ui/dialog";
import { Notice } from "~/components/ui/notice";
import { useI18n } from "~/i18n/i18n";

/**
 * Recovery codes, shown exactly once: they arrive in one API response (enrollment confirmed or
 * codes regenerated) and live only in the memory of the component that received them. Nothing
 * stores, logs, or refetches them; a reload or a navigation loses them for good, and the
 * screen says so. Copying happens only on an explicit press. Until the person confirms they
 * saved the codes, leaving is interrupted: an in-app navigation asks first (useBlocker) and a
 * reload or closing the tab triggers the browser's own warning (beforeunload).
 */
export function RecoveryCodesReveal({
  codes,
  continueLabel,
  onContinue,
  replacedOld = false,
}: {
  codes: string[];
  continueLabel: string;
  onContinue: () => void;
  /** After a regeneration: say the old codes no longer work. */
  replacedOld?: boolean;
}) {
  const { t } = useI18n();
  const [acknowledged, setAcknowledged] = useState(false);
  const [remind, setRemind] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reminderId = useId();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !acknowledged && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (acknowledged) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a value to show their prompt; it is never displayed.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [acknowledged]);

  const finish = () => {
    if (!acknowledged) {
      setRemind(true);
      checkboxRef.current?.focus();

      return;
    }

    onContinue();
  };

  return (
    <section aria-labelledby={`${listId}-title`} className="grid gap-6">
      <div>
        <h2 id={`${listId}-title`} className="text-section font-wide">
          {t.recoveryCodes.title}
        </h2>
        <p className="mt-3 max-w-[64ch] text-ink-muted">{t.recoveryCodes.lede}</p>
      </div>

      {replacedOld ? <Notice tone="success">{t.recoveryCodes.previousInvalid}</Notice> : null}

      <div className="rounded-panel border border-line bg-paper-raised p-5 sm:p-6">
        <ol
          id={listId}
          aria-label={t.recoveryCodes.listLabel}
          className="grid gap-x-8 gap-y-2.5 font-mono text-[0.9375rem] tracking-wide sm:grid-cols-2"
        >
          {codes.map((code, index) => (
            <li key={code} className="flex items-baseline gap-3">
              <span aria-hidden className="w-5 text-right text-meta text-ink-muted tabular-nums">
                {index + 1}
              </span>
              <span className="break-all text-ink select-all">{code}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 border-t border-line pt-4">
          <CopyButton value={codes.join("\n")} label={t.recoveryCodes.copyAll} />
        </div>
      </div>

      <p className="max-w-[64ch] text-[0.9375rem] text-ink">{t.recoveryCodes.where}</p>

      <div className="grid gap-2">
        <label className="flex items-start gap-3 text-[0.9375rem] font-semibold">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => {
              setAcknowledged(event.target.checked);
              setRemind(false);
            }}
            aria-describedby={remind ? reminderId : undefined}
            className="check-input mt-0.5"
          />
          <span>{t.recoveryCodes.acknowledge}</span>
        </label>
        {remind ? (
          <p id={reminderId} role="alert" className="text-meta font-medium text-danger">
            {t.recoveryCodes.acknowledgeFirst}
          </p>
        ) : null}
      </div>

      <div>
        <Button
          variant="primary"
          onClick={finish}
          icon={<ArrowRight aria-hidden size={18} weight="bold" />}
        >
          {continueLabel}
        </Button>
      </div>

      <Dialog
        open={blocker.state === "blocked"}
        title={t.recoveryCodes.leaveTitle}
        description={t.recoveryCodes.leaveBody}
        onClose={() => blocker.reset?.()}
        actions={
          <>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              {t.recoveryCodes.leave}
            </Button>
            <Button variant="primary" onClick={() => blocker.reset?.()} data-autofocus>
              {t.recoveryCodes.stay}
            </Button>
          </>
        }
      />
    </section>
  );
}
