import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useRevalidator,
  useRouteError,
} from "react-router";
import { generalErrorCopy } from "~/auth/error-copy";
import { signInPath } from "~/auth/return-to";
import { markSignedOut, useSessionState } from "~/auth/session";
import { AppShell } from "~/components/layout/app-shell";
import { AuthFrame } from "~/components/layout/auth-frame";
import { Button } from "~/components/ui/button";
import { Notice } from "~/components/ui/notice";
import { LoadingState } from "~/components/ui/state-view";
import { useI18n } from "~/i18n/i18n";
import { useMotion } from "~/lib/motion";
import { retryAt, useSecondsUntil } from "~/lib/time";
import { paths } from "~/routes/paths";
import { type AdminAccount, accountApi, isAdminApiError } from "~/services/admin-api";
import { IdleWarning } from "./idle-warning";
import { ShellFallback } from "./route-error";

/** After this long hidden (or asleep), the console asks Laravel again before showing data. */
const RESUME_CHECK_AFTER_MS = 60_000;
/** A local tick; a gap far longer than it means the device slept. Never a network request. */
const WAKE_TICK_MS = 15_000;

/**
 * Frame of every private screen, rendered only after `requireAccount` verified the account
 * (src/auth/guards.ts).
 *
 * - When Laravel says the session is gone (any 401), another tab signs out, or this tab signs
 *   out, the account view is dropped at once and the person goes to sign-in.
 * - After the tab was hidden, the device slept, or the page came back from the back-forward
 *   cache, the content is hidden and `GET me` runs again before anything shows or can be used.
 * - The idle warning (WCAG 2.2.1) lives here.
 * - When the screen changes, its content rises in (GSAP, ~300 ms, never on the first screen,
 *   never under reduced motion, never awaited): continuity between screens, not decoration.
 */
export function PrivateLayout() {
  const { t } = useI18n();
  const loaded = useLoaderData() as AdminAccount;
  const session = useSessionState();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const pathnameRef = useRef(pathname);
  const revalidateRef = useRef(revalidator.revalidate);
  const content = useRef<HTMLDivElement>(null);
  const shownPath = useRef(pathname);

  useMotion(
    ({ gsap }) => {
      if (shownPath.current !== pathname && content.current !== null) {
        gsap.from(content.current, { y: 10, opacity: 0, duration: 0.32 });
      }
    },
    { dependencies: [pathname] },
  );

  useEffect(() => {
    shownPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    // While a navigation is pending, the person was heading there: return to that screen.
    pathnameRef.current = navigation.location?.pathname ?? pathname;
    revalidateRef.current = revalidator.revalidate;
  });

  useEffect(() => {
    if (session.status !== "signed-out") {
      return;
    }

    navigate(
      signInPath({
        returnTo: session.reason === "expired" ? pathnameRef.current : undefined,
        notice: session.reason,
      }),
      { replace: true },
    );
  }, [session, navigate]);

  const recheck = useCallback(async () => {
    flushSync(() => setChecking(true));

    try {
      await revalidateRef.current();
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    let lastTick = Date.now();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else {
        const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
        hiddenAt = null;

        if (away >= RESUME_CHECK_AFTER_MS) {
          void recheck();
        }
      }
    };

    // Hide the account before the page may enter the back-forward cache, so a restored page
    // never paints stale data; pageshow then checks with Laravel.
    const onPageHide = () => flushSync(() => setChecking(true));
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void recheck();
      } else {
        setChecking(false);
      }
    };

    const tick = window.setInterval(() => {
      const now = Date.now();

      if (now - lastTick > WAKE_TICK_MS + RESUME_CHECK_AFTER_MS) {
        void recheck();
      }

      lastTick = now;
    }, WAKE_TICK_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [recheck]);

  const signOut = useCallback(async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutError(null);

    try {
      await accountApi.logout();
      markSignedOut("signed-out");
    } catch (error) {
      if (isAdminApiError(error) && error.kind === "unauthenticated") {
        // Already ended on the server; the session store has sent us to sign-in.
        return;
      }

      setSignOutError(
        isAdminApiError(error) && error.kind === "csrf"
          ? t.errors.resendNeeded
          : t.shell.signOutUncertain,
      );
    } finally {
      setSigningOut(false);
    }
  }, [signingOut, t]);

  if (session.status === "signed-out") {
    // Nothing of the account stays on screen while the navigation to sign-in happens.
    return <ShellFallback />;
  }

  const account = session.status === "signed-in" ? session.account : loaded;

  return (
    <AppShell session={{ account, signOut: () => void signOut(), signingOut, signOutError }}>
      {checking ? <LoadingState label={t.sessionCheck.checking} rows={4} /> : null}
      <div ref={content} hidden={checking}>
        <Outlet />
      </div>
      <IdleWarning
        account={account}
        onExpired={() => void recheck()}
        onSignOut={() => void signOut()}
      />
    </AppShell>
  );
}

/**
 * The private loader failed with something other than 401: no account was verified, so the
 * screen shows no account data and no navigation, says what happened, and offers a retry.
 */
export function PrivateRouteError() {
  const { t } = useI18n();
  const error = useRouteError();
  const revalidator = useRevalidator();
  const [blockedUntil] = useState<number | null>(() =>
    isAdminApiError(error) && error.kind === "rate-limited"
      ? retryAt(error.retryAfterSeconds)
      : null,
  );
  const wait = useSecondsUntil(blockedUntil);
  const forbidden = isAdminApiError(error) && error.kind === "forbidden";

  return (
    <AuthFrame>
      <article className="max-w-[40rem]">
        <h1 className="text-page font-wide">
          {forbidden ? t.sessionCheck.forbiddenTitle : t.sessionCheck.unavailableTitle}
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">
          {forbidden ? t.sessionCheck.forbiddenBody : t.sessionCheck.unavailableBody}
        </p>
        {blockedUntil !== null ? (
          <Notice tone="warning" className="mt-6">
            {t.errors.rateLimited(wait)}
          </Notice>
        ) : !forbidden ? (
          <Notice tone="danger" className="mt-6">
            {generalErrorCopy(error, t)}
          </Notice>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            variant="primary"
            busy={revalidator.state === "loading"}
            busyLabel={t.sessionCheck.checking}
            aria-disabled={wait > 0 || undefined}
            icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
            onClick={() => (wait > 0 ? undefined : void revalidator.revalidate())}
          >
            {t.common.retry}
          </Button>
          <Link to={paths.signIn} className="btn btn-secondary">
            {t.sessionCheck.toSignIn}
          </Link>
        </div>
      </article>
    </AuthFrame>
  );
}
