import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Plugs } from "@phosphor-icons/react/dist/csr/Plugs";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { Notice } from "~/components/ui/notice";
import { Panel } from "~/components/ui/panel";
import { PasswordField } from "~/components/ui/password-field";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { StatusCapsule } from "~/components/ui/status-capsule";
import { StepTrack } from "~/components/ui/step-track";
import { TextField } from "~/components/ui/text-field";
import { useI18n } from "~/i18n/i18n";
import { cn } from "~/lib/cn";
import { type ConnectionCheck, adminApi, checkAdminApiConnection } from "~/services/admin-api";
import { type ReferenceCopy, referenceCopy } from "./component-reference-copy";

/**
 * Development and QA only (absent from production builds, see src/routes/paths.ts): every base
 * component in every state, so accessibility and both themes can be checked in a real browser,
 * and the developer connection check (moved here from the B3.2a overview, so the production
 * console never shows setup hints). All text is sample copy and says so; nothing here is data.
 */
export function ComponentReference() {
  const { t, locale } = useI18n();
  const r = referenceCopy[locale];
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <article>
      <header className="max-w-[64ch]">
        <h1 className="text-page font-wide">{r.title}</h1>
        <p className="mt-4 text-[1.0625rem] text-ink-muted">{r.lede}</p>
      </header>

      <div className="mt-12 grid gap-12">
        <ConnectionPanel r={r} />

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
            <PasswordField label={r.passwordLabel} autoComplete="off" />
          </div>
        </Section>

        <Section title={r.statuses}>
          <div className="flex flex-wrap gap-3">
            <StatusCapsule status="released" label={t.phases.status.released} />
            <StatusCapsule status="current" label={t.phases.status.current} />
            <StatusCapsule status="planned" label={t.phases.status.planned} />
          </div>
        </Section>

        <Section title={r.feedback}>
          <div className="grid max-w-2xl gap-4">
            <StepTrack label={r.stepsLabel} steps={r.steps} current={1} />
            <Notice tone="info">{r.noticeInfo}</Notice>
            <Notice tone="success">{r.noticeSuccess}</Notice>
            <Notice tone="warning">{r.noticeWarning}</Notice>
            <Notice tone="danger">{r.noticeDanger}</Notice>
            <div>
              <Button onClick={() => setDialogOpen(true)}>{r.dialogOpen}</Button>
            </div>
            <Dialog
              open={dialogOpen}
              title={r.dialogTitle}
              description={r.dialogBody}
              onClose={() => setDialogOpen(false)}
              actions={
                <>
                  <Button variant="quiet" onClick={() => setDialogOpen(false)}>
                    {r.dialogCancel}
                  </Button>
                  <Button variant="primary" onClick={() => setDialogOpen(false)}>
                    {r.dialogConfirm}
                  </Button>
                </>
              }
            />
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

/** Fill `{name}` slots of a message with code-set values, keeping each language's word order. */
function withCode(template: string, values: Record<string, string>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const value = /^\{(\w+)\}$/.exec(part)?.[1];

    return value !== undefined && values[value] !== undefined ? (
      <code
        key={index}
        className="rounded-[0.375rem] bg-paper-sunken px-1.5 py-0.5 font-mono text-[0.875em] whitespace-nowrap text-ink"
      >
        {values[value]}
      </code>
    ) : (
      part
    );
  });
}

type CheckState =
  { phase: "idle" } | { phase: "checking" } | { phase: "done"; result: ConnectionCheck; at: Date };

function ConnectionPanel({ r }: { r: ReferenceCopy }) {
  const { locale } = useI18n();
  const [state, setState] = useState<CheckState>({ phase: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const check = async () => {
    controller.current?.abort();
    controller.current = new AbortController();
    setState({ phase: "checking" });

    const result = await checkAdminApiConnection(adminApi, controller.current.signal);

    if (!controller.current.signal.aborted) {
      setState({ phase: "done", result, at: new Date() });
    }
  };

  const time = (date: Date) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);

  return (
    <Panel title={r.connection.title} className="max-w-2xl">
      <p className="text-[0.9375rem] text-ink-muted">{r.connection.body}</p>

      <Button
        variant="primary"
        className="mt-5"
        busy={state.phase === "checking"}
        busyLabel={r.connection.checking}
        icon={<Plugs aria-hidden size={18} weight="bold" />}
        onClick={check}
      >
        {r.connection.action}
      </Button>

      <div
        role="status"
        aria-live="polite"
        className="mt-5 min-h-[4.5rem] border-t border-line pt-4"
      >
        {state.phase === "done" ? (
          <ConnectionResult result={state.result} r={r} />
        ) : (
          <p className="text-[0.9375rem] text-ink-muted">
            {state.phase === "checking" ? r.connection.checking : r.connection.idle}
          </p>
        )}
        {state.phase === "done" ? (
          <p className="mt-2 text-meta text-ink-muted">{r.connection.checkedAt(time(state.at))}</p>
        ) : null}
      </div>
    </Panel>
  );
}

function ConnectionResult({ result, r }: { result: ConnectionCheck; r: ReferenceCopy }) {
  const copy = r.connection;
  const ok = result.state === "reachable";

  const message = (() => {
    switch (result.state) {
      case "reachable":
        return copy.reachable;
      case "refused":
        return copy.refused(result.status, window.location.origin);
      case "unavailable":
        return copy.unavailable;
      case "rate-limited":
        return copy.rateLimited(result.retryAfterSeconds);
      case "unreachable":
        return withCode(copy.unreachable, { command: "php artisan serve", path: "backend/" });
      case "unexpected":
        return copy.unexpected(result.status);
    }
  })();

  return (
    <p className={cn("flex gap-2.5 text-[0.9375rem]", ok ? "text-ink" : "text-danger")}>
      {ok ? (
        <CheckCircle
          aria-hidden
          size={20}
          weight="bold"
          className="mt-0.5 flex-none text-accent-text"
        />
      ) : (
        <WarningCircle aria-hidden size={20} weight="bold" className="mt-0.5 flex-none" />
      )}
      <span>{message}</span>
    </p>
  );
}
