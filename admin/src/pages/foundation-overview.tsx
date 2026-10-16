import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Plugs } from "@phosphor-icons/react/dist/csr/Plugs";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Phase, phases } from "~/app/phases";
import { Button } from "~/components/ui/button";
import { Panel } from "~/components/ui/panel";
import { PhaseGlyph, StatusCapsule } from "~/components/ui/status-capsule";
import { useI18n } from "~/i18n/i18n";
import type { Messages } from "~/i18n/messages/id";
import { cn } from "~/lib/cn";
import { type ConnectionCheck, adminApi, checkAdminApiConnection } from "~/services/admin-api";

/**
 * The console's only real screen in B3.2a: what exists, what each phase adds, and one honest
 * connection check. No sign-in, no account data, no numbers (owner decision 2026-10-16).
 */
export function FoundationOverview() {
  const { t } = useI18n();

  return (
    <article>
      <header className="max-w-[64ch]">
        <h1 className="text-page font-wide">{t.foundation.title}</h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">{t.foundation.lede}</p>
      </header>

      <div className="mt-12 grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-14">
        <PhaseTrack />
        <ConnectionPanel />
      </div>
    </article>
  );
}

function PhaseTrack() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="phases-title">
      <h2 id="phases-title" className="text-section font-wide">
        {t.foundation.phasesTitle}
      </h2>
      <p className="mt-2 max-w-[60ch] text-ink-muted">{t.foundation.phasesIntro}</p>

      <ol className="relative mt-7 grid gap-1.5">
        {/* One spine through every phase, as on the website's ecosystem map. */}
        <span aria-hidden className="absolute top-6 bottom-6 left-[1.6rem] w-px bg-line-strong" />
        {phases.map((phase) => (
          <PhaseRow key={phase.code} phase={phase} t={t} />
        ))}
      </ol>
    </section>
  );
}

function PhaseRow({ phase, t }: { phase: Phase; t: Messages }) {
  const copy = t.foundation.phases[phase.code];
  const current = phase.status === "current";

  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "relative grid grid-cols-[3.2rem_minmax(0,1fr)] gap-x-2 rounded-[1.25rem] py-4 pr-4",
        current && "bg-paper-raised ring-1 ring-line",
      )}
    >
      <span className="relative flex justify-center pt-1.5">
        {/* A ground-coloured disc lets the glyph sit on the spine without the line showing through. */}
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full",
            current ? "bg-paper-raised" : "bg-paper",
          )}
        >
          <PhaseGlyph status={phase.status} />
        </span>
      </span>
      <div className="min-w-0">
        {/* The code is part of the heading, so a long title wraps after it, never under it. */}
        <h3 className="text-item font-wide">
          <span className="mr-3 text-meta font-semibold text-ink-muted tabular-nums">
            {phase.label}
          </span>
          {copy.title}
        </h3>
        <p className="mt-1.5 max-w-[62ch] text-[0.9375rem] text-ink-muted">{copy.detail}</p>
        <div className="mt-3">
          <StatusCapsule
            status={phase.status}
            label={t.foundation.phaseStatus[phase.status]}
            glyph={false}
          />
        </div>
      </div>
    </li>
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

function ConnectionPanel() {
  const { t, locale } = useI18n();
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
    <Panel title={t.foundation.connection.title} className="xl:sticky xl:top-10">
      <p className="text-[0.9375rem] text-ink-muted">{t.foundation.connection.body}</p>

      <Button
        variant="primary"
        className="mt-5"
        busy={state.phase === "checking"}
        busyLabel={t.foundation.connection.checking}
        icon={<Plugs aria-hidden size={18} weight="bold" />}
        onClick={check}
      >
        {t.foundation.connection.action}
      </Button>

      <div
        role="status"
        aria-live="polite"
        className="mt-5 min-h-[4.5rem] border-t border-line pt-4"
      >
        {state.phase === "done" ? (
          <ConnectionResult result={state.result} t={t} />
        ) : (
          <p className="text-[0.9375rem] text-ink-muted">
            {state.phase === "checking"
              ? t.foundation.connection.checking
              : t.foundation.connection.idle}
          </p>
        )}
        {state.phase === "done" ? (
          <p className="mt-2 text-meta text-ink-muted">
            {t.foundation.connection.checkedAt(time(state.at))}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function ConnectionResult({ result, t }: { result: ConnectionCheck; t: Messages }) {
  const copy = t.foundation.connection;
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
