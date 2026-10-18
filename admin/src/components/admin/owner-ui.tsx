import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { Link } from "react-router";
import { generalErrorCopy } from "~/auth/error-copy";
import { markVerified } from "~/auth/session";
import { Button } from "~/components/ui/button";
import { useOwnerI18n } from "~/i18n/owner";
import type { OwnerCopy } from "~/i18n/owner";
import { useMotion } from "~/lib/motion";
import { paths } from "~/routes/paths";
import { type AdminPermission, accountApi, isAdminApiError } from "~/services/admin-api";

/** Re-read the account after a 403, so navigation follows the permissions Laravel reports now. */
export const refreshAccount = (): Promise<void> =>
  accountApi.me().then(markVerified, () => undefined);

export const hasPermission = (
  account: { permissions: AdminPermission[] },
  permission: AdminPermission,
): boolean => account.permissions.includes(permission);

/** Why a list could not load, in the words a person can act on. */
export function listErrorCopy(error: unknown, t: OwnerCopy): string {
  if (isAdminApiError(error)) {
    if (error.kind === "validation") {
      return t.owner.filterRefused;
    }

    if (error.kind === "rate-limited") {
      return t.errors.rateLimited(error.retryAfterSeconds ?? 60);
    }
  }

  return generalErrorCopy(error, t);
}

export const isForbidden = (error: unknown): boolean =>
  isAdminApiError(error) && error.kind === "forbidden";

/** Title, lede, and the screen's one primary action, aligned to the title on wide screens. */
export function PageHeader({
  title,
  lede,
  action,
  back,
}: {
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="max-w-[64ch] min-w-0">
        {back ? (
          <Link
            to={back.to}
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-[0.9375rem] font-semibold text-ink-muted transition-colors duration-[var(--dur-state)] hover:text-ink"
          >
            <ArrowLeft aria-hidden size={18} weight="bold" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-page break-words font-wide">{title}</h1>
        {lede ? (
          <div className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">{lede}</div>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </header>
  );
}

/**
 * The foot of a list: how many rows are shown (a polite status, so a screen reader hears the
 * result of a filter or a load) and the load-more control while Laravel has a next cursor.
 */
export function ListFooter({
  summary,
  hasMore,
  busy,
  error,
  loadLabel,
  onLoadMore,
}: {
  summary: string;
  hasMore: boolean;
  busy: boolean;
  error: unknown;
  loadLabel: string;
  onLoadMore: () => void;
}) {
  const { t } = useOwnerI18n();

  return (
    <div className="mt-6 grid justify-items-start gap-3">
      <p role="status" className="text-meta text-ink-muted">
        {summary}
      </p>
      {hasMore ? (
        <Button busy={busy} busyLabel={t.owner.loadingMore} onClick={onLoadMore}>
          {loadLabel}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-meta font-medium text-danger">
          {t.owner.moreFailed} {listErrorCopy(error, t)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * An owner screen opened by an account without the permission (or refused by Laravel with 403):
 * it says which role is needed and shows no data. Laravel stays the authority; this only
 * explains its answer.
 */
export function ForbiddenState() {
  const { t } = useOwnerI18n();

  return (
    <div className="max-w-[44rem] rounded-panel border border-line bg-paper-raised p-6 sm:p-8">
      <LockKey aria-hidden size={28} weight="bold" className="text-accent-text" />
      <h2 className="mt-4 text-section font-wide">{t.owner.forbiddenTitle}</h2>
      <p className="mt-2 text-ink-muted">{t.owner.forbiddenBody}</p>
      <Link to={paths.home} className="mt-6 btn btn-secondary">
        {t.owner.toHome}
      </Link>
    </div>
  );
}

/**
 * Rows rise in when a list's content changes (first load, new filters, load more): only the
 * new rows, at most twelve staggered, under 300 ms in all. Nothing waits for it and nothing is
 * hidden without GSAP or under reduced motion.
 */
export function useRowEntrance(
  scope: RefObject<Element | null>,
  revision: string | null,
  from: number,
) {
  useMotion(
    ({ gsap }) => {
      const rows = scope.current?.querySelectorAll<HTMLElement>("[data-row]");

      if (!rows || revision === null) {
        return;
      }

      const fresh = [...rows].slice(from, from + 12);

      if (fresh.length > 0) {
        gsap.from(fresh, { y: 8, opacity: 0, duration: 0.26, stagger: 0.02 });
      }
    },
    { scope, dependencies: [revision] },
  );
}

/**
 * Move focus to `ref` when `trigger` becomes set (a result notice, a revealed link), one frame
 * later: a native <dialog> that closes in the same update returns focus to its opener first,
 * and that opener may be gone (its action changed), which would leave focus on the page body.
 */
export function useFocusWhen(ref: RefObject<HTMLElement | null>, trigger: unknown) {
  useEffect(() => {
    if (!trigger) {
      return;
    }

    const frame = window.requestAnimationFrame(() => ref.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, [ref, trigger]);
}

/** After "load more", focus the first new row's link, so keyboard users continue from there. */
export function useFocusAppended(scope: RefObject<Element | null>, appendedFrom: number | null) {
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (appendedFrom === null || appendedFrom === last.current) {
      return;
    }

    last.current = appendedFrom;
    const row = scope.current?.querySelectorAll<HTMLElement>("[data-row]")[appendedFrom];

    if (row === undefined) {
      return;
    }

    const control = row.querySelector<HTMLElement>("a, button, summary");

    if (control) {
      control.focus();
    } else {
      // A row without a control (an invitation that can no longer be revoked) takes focus
      // itself, for this one move only.
      row.tabIndex = -1;
      row.focus();
    }
  }, [scope, appendedFrom]);
}
