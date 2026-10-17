import type { ReactNode } from "react";
import { useVerifiedAccount } from "~/auth/use-account";
import { useI18n } from "~/i18n/i18n";
import { formatDateTime } from "~/lib/time";

/**
 * A read-only list of facts, hairlines between rows. Term and value sit side by side only when
 * the list itself is wide enough (a container query), so a narrow side panel stacks them.
 */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <dl className="grid divide-y divide-line">{children}</dl>
    </div>
  );
}

export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3.5 first:pt-1 last:pb-0 @md:grid-cols-[12rem_minmax(0,1fr)] @md:gap-6">
      <dt className="text-[0.9375rem] text-ink-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/** Sign-in time, absolute end, and the idle rule, as Laravel reports them for this session. */
export function SessionFacts() {
  const { t, locale } = useI18n();
  const { session } = useVerifiedAccount();

  return (
    <Facts>
      <Fact term={t.home.signedInAt}>
        {formatDateTime(session.signed_in_at, locale) ?? t.common.notRecorded}
      </Fact>
      <Fact term={t.home.endsBy}>
        {formatDateTime(session.absolute_expires_at, locale) ?? t.common.notRecorded}
        <span className="mt-1 block text-[0.9375rem] text-ink-muted">
          {t.home.idleRule(session.idle_timeout_minutes)}
        </span>
      </Fact>
    </Facts>
  );
}
