import { useEffect, useRef, useState } from "react";
import { getSessionState, markVerified, useLastContactAt } from "~/auth/session";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { useI18n } from "~/i18n/i18n";
import { clockText, useSecondsUntil } from "~/lib/time";
import { type AdminAccount, accountApi, isAdminApiError } from "~/services/admin-api";

/** How long before the expected idle expiry the warning opens (WCAG 2.2.1 needs 20 s). */
const IDLE_WARNING_MS = 5 * 60_000;
/** How long before the 12-hour limit the person is told it is coming. */
const ABSOLUTE_WARNING_MS = 10 * 60_000;
/** Margin after the expected expiry before the console checks with Laravel. */
const EXPIRY_GRACE_MS = 5_000;

type Warning = "none" | "idle" | "absolute";

/**
 * The idle and absolute-limit warnings (docs/architecture/admin-dashboard.md section 7, WCAG
 * 2.2.1). Laravel decides when a session ends; this only estimates it from the last time this
 * browser reached the server (src/auth/session.ts), so it never polls and never keeps a
 * session alive by itself.
 *
 * - Five minutes before the expected idle expiry: "stay signed in" sends one real `GET me`
 *   (the person's own action), which resets the server's idle timer.
 * - Ten minutes before the 12-hour limit: a notice that cannot extend anything.
 * - When an expiry should have passed: `onExpired`, which checks with Laravel (one `GET me`)
 *   while the screen is hidden; a 401 then leads to sign-in.
 */
export function IdleWarning({
  account,
  onExpired,
  onSignOut,
}: {
  account: AdminAccount;
  onExpired: () => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const lastContactAt = useLastContactAt();
  const [warning, setWarning] = useState<Warning>("none");
  const [absoluteDismissed, setAbsoluteDismissed] = useState(false);
  const [extending, setExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  });

  const idleMs = Math.max(1, account.session.idle_timeout_minutes) * 60_000;
  const idleDeadline = lastContactAt + idleMs;
  const idleWarnAt = idleDeadline - Math.min(IDLE_WARNING_MS, idleMs / 2);

  const state = getSessionState();
  const offset = state.status === "signed-in" ? state.serverClockOffsetMs : 0;
  const absoluteServer = Date.parse(account.session.absolute_expires_at ?? "");
  // Laravel's deadline in this device's clock.
  const absoluteDeadline = Number.isNaN(absoluteServer) ? null : absoluteServer - offset;

  useEffect(() => {
    if (lastContactAt === 0) {
      return;
    }

    let timer: number | undefined;

    const evaluate = () => {
      const now = Date.now();

      if (
        now >= idleDeadline + EXPIRY_GRACE_MS ||
        (absoluteDeadline !== null && now >= absoluteDeadline + EXPIRY_GRACE_MS)
      ) {
        setWarning("none");
        onExpiredRef.current();

        return;
      }

      if (now >= idleWarnAt) {
        setWarning("idle");
      } else if (
        absoluteDeadline !== null &&
        now >= absoluteDeadline - ABSOLUTE_WARNING_MS &&
        !absoluteDismissed
      ) {
        setWarning("absolute");
      } else {
        setWarning("none");
      }

      const upcoming = [
        idleWarnAt,
        idleDeadline + EXPIRY_GRACE_MS,
        ...(absoluteDeadline === null
          ? []
          : [absoluteDeadline - ABSOLUTE_WARNING_MS, absoluteDeadline + EXPIRY_GRACE_MS]),
      ].filter((moment) => moment > now);
      const next = Math.min(...upcoming);

      if (Number.isFinite(next)) {
        // Timers fire late after sleep; evaluate() compares real time, so late is still right.
        timer = window.setTimeout(evaluate, Math.min(next - now + 50, 2 ** 31 - 1));
      }
    };

    evaluate();

    return () => window.clearTimeout(timer);
  }, [lastContactAt, idleDeadline, idleWarnAt, absoluteDeadline, absoluteDismissed]);

  const idleSeconds = useSecondsUntil(warning === "idle" ? idleDeadline : null);
  const absoluteSeconds = useSecondsUntil(warning === "absolute" ? absoluteDeadline : null);

  const stay = async () => {
    if (extending) {
      return;
    }

    setExtending(true);
    setError(null);

    try {
      // A real request: Laravel resets the idle timer, or answers 401 if it already ended.
      markVerified(await accountApi.me());
    } catch (failure) {
      if (!(isAdminApiError(failure) && failure.kind === "unauthenticated")) {
        setError(t.errors.unreachable);
      }
    } finally {
      setExtending(false);
    }
  };

  return (
    <>
      <Dialog
        role="alertdialog"
        open={warning === "idle"}
        title={t.idle.title}
        description={t.idle.body(clockText(idleSeconds))}
        onClose={() => void stay()}
        actions={
          <>
            <Button variant="quiet" onClick={onSignOut}>
              {t.idle.signOut}
            </Button>
            <Button
              variant="primary"
              busy={extending}
              busyLabel={t.idle.staying}
              onClick={() => void stay()}
              data-autofocus
            >
              {t.idle.stay}
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="text-meta font-medium text-danger">
            {error}
          </p>
        ) : null}
      </Dialog>

      <Dialog
        role="alertdialog"
        open={warning === "absolute"}
        title={t.idle.absoluteTitle}
        description={t.idle.absoluteBody(clockText(absoluteSeconds))}
        onClose={() => {
          setAbsoluteDismissed(true);
          setWarning("none");
        }}
        actions={
          <>
            <Button variant="quiet" onClick={onSignOut}>
              {t.idle.signOut}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAbsoluteDismissed(true);
                setWarning("none");
              }}
              data-autofocus
            >
              {t.idle.understood}
            </Button>
          </>
        }
      />
    </>
  );
}
