import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { type ReactNode, useState } from "react";
import { Button } from "~/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { StatusCapsule } from "~/components/ui/status-capsule";
import { TextField } from "~/components/ui/text-field";
import { useI18n } from "~/i18n/i18n";
import { referenceCopy } from "./component-reference-copy";

/**
 * Development and QA only (absent from production builds, see src/routes/paths.ts): every base
 * component in every state, so accessibility and both themes can be checked in a real browser.
 * All text is sample copy and says so; nothing here is data.
 */
export function ComponentReference() {
  const { t, locale } = useI18n();
  const r = referenceCopy[locale];
  const [busy, setBusy] = useState(false);

  return (
    <article>
      <header className="max-w-[64ch]">
        <h1 className="text-page font-wide">{r.title}</h1>
        <p className="mt-4 text-[1.0625rem] text-ink-muted">{r.lede}</p>
      </header>

      <div className="mt-12 grid gap-12">
        <Section title={r.buttons}>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon={<ArrowRight aria-hidden size={18} weight="bold" />}>
              {r.primary}
            </Button>
            <Button variant="secondary">{r.secondary}</Button>
            <Button variant="quiet">{r.quiet}</Button>
            <Button variant="danger">{r.danger}</Button>
            <Button
              variant="primary"
              busy={busy}
              busyLabel={r.busy}
              onClick={() => {
                setBusy(true);
                window.setTimeout(() => setBusy(false), 1600);
              }}
            >
              {r.primary}
            </Button>
            <Button disabled>{r.disabled}</Button>
          </div>
        </Section>

        <Section title={r.fields}>
          <div className="grid max-w-md gap-6">
            <TextField label={r.emailLabel} type="email" autoComplete="off" hint={r.emailHint} />
            <TextField
              label={r.emailLabel}
              type="email"
              autoComplete="off"
              defaultValue="bukan-email"
              error={r.emailError}
            />
          </div>
        </Section>

        <Section title={r.statuses}>
          <div className="flex flex-wrap gap-3">
            <StatusCapsule status="released" label={t.foundation.phaseStatus.released} />
            <StatusCapsule status="current" label={t.foundation.phaseStatus.current} />
            <StatusCapsule status="planned" label={t.foundation.phaseStatus.planned} />
          </div>
        </Section>

        <Section title={r.states}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="grid content-start gap-3">
              <h3 className="text-meta font-semibold text-ink-muted">{r.loading}</h3>
              <LoadingState label={r.loading} />
            </div>
            <div className="grid content-start gap-3">
              <h3 className="text-meta font-semibold text-ink-muted">{r.empty}</h3>
              <EmptyState title={r.emptyTitle}>{r.emptyBody}</EmptyState>
            </div>
            <div className="grid content-start gap-3">
              <h3 className="text-meta font-semibold text-ink-muted">{r.failed}</h3>
              <ErrorState title={r.failedTitle} retryLabel={r.retry} onRetry={() => undefined}>
                {r.failedBody}
              </ErrorState>
            </div>
          </div>
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="text-section font-wide">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
