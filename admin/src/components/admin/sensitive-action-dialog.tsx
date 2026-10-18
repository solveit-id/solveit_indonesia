import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { generalErrorCopy, isUncertain } from "~/auth/error-copy";
import { useVerifiedAccount } from "~/auth/use-account";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { PasswordField } from "~/components/ui/password-field";
import { useOwnerI18n } from "~/i18n/owner";
import { retryAt, useSecondsUntil } from "~/lib/time";
import { type AdminApiError, accountApi, isAdminApiError } from "~/services/admin-api";

/** One owner write, described for the person before anything is sent. */
export interface SensitiveAction<R> {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  tone?: "primary" | "danger";
  /** Extra content of the decision (an acknowledgement checkbox); kept across steps. */
  children?: ReactNode;
  /** While set, pressing the action sends nothing and this sentence explains why. */
  blockedReason?: string | null;
  /** The write. Called once per explicit press, never by itself. */
  run: () => Promise<R>;
  /** Laravel applied it. The caller closes the dialog and says what changed. */
  onDone: (result: R) => void;
  /** Nobody knows whether it applied (5xx, network, timeout, unreadable success). The caller
   * closes the dialog and offers a read to find out; the write is never resent by itself. */
  onUncertain: (error: unknown) => void;
  /** 404 or 409: the record changed under us; the caller reloads it. */
  onStale?: () => void;
  /** 403: this account lost the permission; the caller re-verifies the account. */
  onForbidden?: () => void;
  /** 422: the caller maps field errors. Return a sentence to show here, or null when the
   * caller handled it (for example by closing and focusing the field). */
  onValidation?: (error: AdminApiError) => string | null;
}

type Step = "confirm" | "reauth" | "reauthed" | "finished";

interface Message {
  tone: NoticeTone;
  text: string;
}

/**
 * Every owner write goes through this dialog (B3.2c, owner brief: sensitive writes need an
 * explicit confirmation and are never retried automatically). One dialog whose content
 * advances, as in the B3.2b recovery-code flow:
 *
 * 1. `confirm`: what will happen, in words; the person presses the named action.
 * 2. `reauth`, only when Laravel answers 423 (no password confirmation in the last 15 minutes):
 *    `POST auth/confirm-password`. Nothing has changed yet, and the dialog says so.
 * 3. `reauthed`: the person decides once more; only that press sends the write again.
 *
 * Refusals keep the dialog with the reason: 419 (nothing processed, press again), 429 (a
 * countdown, nothing sent meanwhile), 409 with its stable code, 404, 403. After a refusal that
 * cannot succeed by pressing again (409, 404, 403) only "close" remains. A 401 is the session
 * store's (back to sign-in). An uncertain outcome closes the dialog through `onUncertain`.
 */
export function SensitiveActionDialog<R>({
  open,
  action,
  onClose,
}: {
  open: boolean;
  action: SensitiveAction<R> | null;
  onClose: () => void;
}) {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const [step, setStep] = useState<Step>("confirm");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [openedBefore, setOpenedBefore] = useState(open);
  const inFlight = useRef(false);
  const wait = useSecondsUntil(blockedUntil);
  const copy = t.sensitive;

  // Each opening starts from the decision (state reset during render, React's documented way).
  if (open !== openedBefore) {
    setOpenedBefore(open);

    if (open) {
      setStep("confirm");
      setPassword("");
      setPasswordError(undefined);
      setMessage(null);
      setBlockedUntil(null);
    }
  }

  const once = async (work: () => Promise<void>) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setBusy(true);

    try {
      await work();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const rateLimited = (error: AdminApiError) => {
    setBlockedUntil(retryAt(error.retryAfterSeconds));
  };

  const perform = () => {
    if (action === null || wait > 0) {
      return;
    }

    if (action.blockedReason) {
      setMessage({ tone: "danger", text: action.blockedReason });

      return;
    }

    void once(async () => {
      setMessage(null);

      try {
        action.onDone(await action.run());
      } catch (error) {
        if (!isAdminApiError(error)) {
          action.onUncertain(error);

          return;
        }

        switch (error.kind) {
          case "unauthenticated":
            return;
          case "password-confirmation-required":
            setPassword("");
            setPasswordError(undefined);
            setStep("reauth");

            return;
          case "csrf":
            setMessage({ tone: "warning", text: copy.resend });

            return;
          case "rate-limited":
            rateLimited(error);

            return;
          case "conflict":
            setMessage({
              tone: "danger",
              text: error.conflictCode ? copy.conflict[error.conflictCode] : copy.conflictUnknown,
            });
            setStep("finished");
            action.onStale?.();

            return;
          case "not-found":
            setMessage({ tone: "danger", text: copy.notFound });
            setStep("finished");
            action.onStale?.();

            return;
          case "forbidden":
            setMessage({ tone: "danger", text: copy.forbidden });
            setStep("finished");
            action.onForbidden?.();

            return;
          case "validation": {
            const text = action.onValidation
              ? action.onValidation(error)
              : generalErrorCopy(error, t);

            if (text !== null) {
              setMessage({ tone: "danger", text });
            }

            return;
          }
          default:
            if (isUncertain(error)) {
              action.onUncertain(error);
            } else {
              setMessage({ tone: "danger", text: generalErrorCopy(error, t) });
            }
        }
      }
    });
  };

  const confirmPassword = (event: FormEvent) => {
    event.preventDefault();

    if (wait > 0) {
      return;
    }

    if (password === "") {
      setPasswordError(t.signIn.passwordMissing);

      return;
    }

    void once(async () => {
      try {
        await accountApi.confirmPassword(password);
        setPassword("");
        setPasswordError(undefined);
        setMessage(null);
        // Confirmed, nothing sent yet: the person decides once more.
        setStep("reauthed");
      } catch (error) {
        setPassword("");

        if (isAdminApiError(error) && error.kind === "unauthenticated") {
          // The session store has already sent the person to sign-in.
          return;
        }

        if (!isAdminApiError(error)) {
          setPasswordError(t.errors.unreachable);
        } else if (error.kind === "validation") {
          setPasswordError(copy.wrongPassword);
        } else if (error.kind === "rate-limited") {
          rateLimited(error);
        } else {
          setPasswordError(generalErrorCopy(error, t));
        }
      }
    });
  };

  const close = () => {
    if (!busy) {
      setPassword("");
      onClose();
    }
  };

  const title =
    step === "reauth"
      ? copy.reauthTitle
      : step === "reauthed"
        ? copy.reauthedTitle
        : (action?.title ?? "");
  const description =
    step === "reauth"
      ? copy.reauthBody
      : step === "reauthed"
        ? copy.reauthedBody(action?.confirmLabel ?? "")
        : action?.description;

  return (
    <Dialog
      open={open && action !== null}
      focusKey={step}
      title={title}
      description={description}
      onClose={close}
      actions={
        step === "finished" ? (
          <Button variant="secondary" onClick={close} data-autofocus>
            {t.common.close}
          </Button>
        ) : step === "reauth" ? (
          <>
            <Button variant="quiet" onClick={close}>
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              form="sensitive-reauth"
              variant="primary"
              busy={busy}
              busyLabel={copy.confirmingPassword}
              aria-disabled={wait > 0 || undefined}
            >
              {copy.confirmPassword}
            </Button>
          </>
        ) : (
          <>
            <Button variant="quiet" onClick={close} data-autofocus>
              {t.common.cancel}
            </Button>
            <Button
              variant={action?.tone ?? "primary"}
              busy={busy}
              busyLabel={action?.busyLabel}
              aria-disabled={wait > 0 || undefined}
              onClick={perform}
            >
              {action?.confirmLabel}
            </Button>
          </>
        )
      }
    >
      {step === "confirm" || step === "reauthed" ? action?.children : null}

      {step === "reauth" ? (
        <form id="sensitive-reauth" noValidate onSubmit={confirmPassword}>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={account.email}
            readOnly
            hidden
          />
          <PasswordField
            label={copy.password}
            name="password"
            autoComplete="current-password"
            required
            data-autofocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
          />
        </form>
      ) : null}

      {wait > 0 ? <Notice tone="warning">{t.errors.rateLimited(wait)}</Notice> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Dialog>
  );
}
