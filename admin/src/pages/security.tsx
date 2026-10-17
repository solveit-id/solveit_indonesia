import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Key } from "@phosphor-icons/react/dist/csr/Key";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { generalErrorCopy, isUncertain } from "~/auth/error-copy";
import { markVerified } from "~/auth/session";
import { useVerifiedAccount } from "~/auth/use-account";
import { RecoveryCodesReveal } from "~/components/account/recovery-codes-reveal";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { PasswordField } from "~/components/ui/password-field";
import { ErrorState, LoadingState } from "~/components/ui/state-view";
import { useI18n } from "~/i18n/i18n";
import type { Messages } from "~/i18n/messages/id";
import { newPasswordProblem } from "~/lib/password-policy";
import { formatDateTime } from "~/lib/time";
import { deviceLabel } from "~/lib/user-agent";
import {
  type AdminApiError,
  type AdminSessionSummary,
  accountApi,
  isAdminApiError,
} from "~/services/admin-api";

interface Message {
  tone: NoticeTone;
  text: string;
}

/** A 401 is handled by the private layout (back to sign-in); screens say nothing about it. */
const isSessionLoss = (error: unknown) =>
  isAdminApiError(error) && error.kind === "unauthenticated";

function errorMessage(error: unknown, t: Messages, uncertain: string): Message | null {
  if (isSessionLoss(error)) {
    return null;
  }

  if (isAdminApiError(error) && error.kind === "rate-limited") {
    return {
      tone: "warning",
      text: t.errors.rateLimited((error as AdminApiError).retryAfterSeconds ?? 60),
    };
  }

  return { tone: "danger", text: isUncertain(error) ? uncertain : generalErrorCopy(error, t) };
}

/** Refresh the account after a change (recovery-code count, rotated session). */
const refreshAccount = () => accountApi.me().then(markVerified, () => undefined);

/**
 * Own-account security (docs/api/admin-auth.md, Terautentikasi): password, recovery codes,
 * sessions. Every write is sent once, on an explicit press; a 419 or an uncertain outcome is
 * reported and never resent by itself (client.ts keeps these writes on `confirm`).
 */
export function Security() {
  const { t } = useI18n();
  // Sessions reload after a password change (other sessions end, this one gets a new ID).
  const [sessionsVersion, setSessionsVersion] = useState(0);

  return (
    <article>
      <header className="max-w-[64ch]">
        <h1 className="text-page font-wide">{t.security.title}</h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">{t.security.lede}</p>
      </header>

      <div className="mt-12 grid max-w-[52rem] gap-14">
        <PasswordSection onChanged={() => setSessionsVersion((version) => version + 1)} />
        <RecoverySection />
        <SessionsSection version={sessionsVersion} />
      </div>
    </article>
  );
}

function SectionHeading({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <div className="max-w-[64ch]">
      <h2 id={id} className="text-section font-wide">
        {title}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">{body}</p>
    </div>
  );
}

function PasswordSection({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const account = useVerifiedAccount();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"current" | "next" | "confirmation", string>>
  >({});
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const copy = t.security.password;

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    const found: typeof errors = {};
    const problem = newPasswordProblem(next, confirmation);

    if (current === "") {
      found.current = copy.currentMissing;
    }

    if (problem === "too-short") {
      found.next = t.access.tooShort;
    } else if (problem === "too-long") {
      found.next = t.access.tooLong;
    } else if (problem === "mismatch") {
      found.confirmation = t.access.mismatch;
    }

    setErrors(found);

    if (found.current || found.next || found.confirmation) {
      (found.current ? currentRef : found.next ? nextRef : confirmationRef).current?.focus();

      return;
    }

    inFlight.current = true;
    setBusy(true);
    setMessage(null);

    try {
      const result = await accountApi.changePassword({
        current_password: current,
        password: next,
        password_confirmation: confirmation,
      });
      setCurrent("");
      setNext("");
      setConfirmation("");
      setMessage({ tone: "success", text: copy.changed(result.other_sessions_ended) });
      await refreshAccount();
      onChanged();
    } catch (error) {
      if (isAdminApiError(error) && error.kind === "validation") {
        setErrors({
          current: error.fieldErrors.current_password ? copy.currentWrong : undefined,
          next: error.fieldErrors.password ? copy.newRejected : undefined,
        });
        (error.fieldErrors.current_password ? currentRef : nextRef).current?.focus();
      } else {
        setMessage(errorMessage(error, t, copy.uncertain));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="password-title" className="grid gap-6 border-t border-line pt-8">
      <SectionHeading id="password-title" title={copy.title} body={copy.body} />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <form noValidate onSubmit={submit} className="grid max-w-[30rem] gap-6">
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={account.email}
          readOnly
          hidden
        />
        <PasswordField
          ref={currentRef}
          label={copy.current}
          name="current-password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          error={errors.current}
        />
        <PasswordField
          ref={nextRef}
          label={t.access.newPassword}
          hint={t.access.passwordHint}
          name="new-password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
          error={errors.next}
        />
        <PasswordField
          ref={confirmationRef}
          label={t.access.confirmPassword}
          name="new-password-confirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={errors.confirmation}
        />
        <div>
          <Button type="submit" variant="primary" busy={busy} busyLabel={copy.submitting}>
            {copy.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}

type RecoveryFlow =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "reauth"; error?: string }
  | { kind: "reauthed" }
  | { kind: "codes"; codes: string[] };

function RecoverySection() {
  const { t } = useI18n();
  const account = useVerifiedAccount();
  const [flow, setFlow] = useState<RecoveryFlow>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const copy = t.security.recovery;

  const once = async (action: () => Promise<void>) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setBusy(true);

    try {
      await action();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /** One explicit regeneration. A 423 asks for the password; it never regenerates by itself. */
  const regenerate = () =>
    once(async () => {
      setMessage(null);

      try {
        const result = await accountApi.regenerateRecoveryCodes();
        setFlow({ kind: "codes", codes: result.recovery_codes });
      } catch (error) {
        if (isAdminApiError(error) && error.kind === "password-confirmation-required") {
          setPassword("");
          setFlow({ kind: "reauth" });

          return;
        }

        setFlow({ kind: "idle" });
        setMessage(errorMessage(error, t, copy.uncertain));
      }
    });

  const confirmPassword = (event: FormEvent) => {
    event.preventDefault();

    if (password === "") {
      setFlow({ kind: "reauth", error: t.signIn.passwordMissing });

      return;
    }

    void once(async () => {
      try {
        await accountApi.confirmPassword(password);
        setPassword("");
        // Confirmed, but nothing regenerated yet: the person decides once more.
        setFlow({ kind: "reauthed" });
      } catch (error) {
        setPassword("");

        if (isAdminApiError(error) && error.kind === "validation") {
          setFlow({ kind: "reauth", error: t.security.reauth.wrong });
        } else if (!isSessionLoss(error)) {
          const failure = errorMessage(error, t, t.errors.unreachable);
          setFlow({ kind: "reauth", error: failure?.text });
        }
      }
    });
  };

  const close = () => {
    if (!busy) {
      setPassword("");
      setFlow({ kind: "idle" });
    }
  };

  if (flow.kind === "codes") {
    return (
      <section aria-label={copy.title} className="border-t border-line pt-8">
        <RecoveryCodesReveal
          codes={flow.codes}
          replacedOld
          continueLabel={t.recoveryCodes.done}
          onContinue={() => {
            setFlow({ kind: "idle" });
            void refreshAccount();
          }}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="recovery-title" className="grid gap-6 border-t border-line pt-8">
      <SectionHeading id="recovery-title" title={copy.title} body={copy.body} />
      <p className="text-item font-semibold">
        {copy.remaining(account.two_factor.recovery_codes_remaining)}
      </p>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div>
        <Button
          icon={<Key aria-hidden size={18} weight="bold" />}
          onClick={() => {
            setMessage(null);
            setFlow({ kind: "confirm" });
          }}
        >
          {copy.action}
        </Button>
      </div>

      {/* One dialog whose content advances: the decision, the password when Laravel answers
          423, then the deliberate second decision the regeneration needs. */}
      <Dialog
        open={flow.kind === "confirm" || flow.kind === "reauth" || flow.kind === "reauthed"}
        focusKey={flow.kind}
        title={
          flow.kind === "reauth"
            ? t.security.reauth.title
            : flow.kind === "reauthed"
              ? t.security.reauth.confirmedTitle
              : copy.confirmTitle
        }
        description={
          flow.kind === "reauth"
            ? t.security.reauth.body
            : flow.kind === "reauthed"
              ? t.security.reauth.confirmedBody
              : copy.confirmBody
        }
        onClose={close}
        actions={
          flow.kind === "reauth" ? (
            <>
              <Button variant="quiet" onClick={close}>
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                form="reauth-form"
                variant="primary"
                busy={busy}
                busyLabel={t.security.reauth.confirming}
              >
                {t.security.reauth.submit}
              </Button>
            </>
          ) : (
            <>
              <Button variant="quiet" onClick={close} data-autofocus>
                {t.common.cancel}
              </Button>
              <Button variant="primary" busy={busy} busyLabel={copy.creating} onClick={regenerate}>
                {copy.confirmAction}
              </Button>
            </>
          )
        }
      >
        {flow.kind === "reauth" ? (
          <form id="reauth-form" noValidate onSubmit={confirmPassword}>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={account.email}
              readOnly
              hidden
            />
            <PasswordField
              label={t.security.reauth.password}
              name="password"
              autoComplete="current-password"
              required
              data-autofocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={flow.error}
            />
          </form>
        ) : null}
      </Dialog>
    </section>
  );
}

type SessionsState =
  | { kind: "loading" }
  | { kind: "failed"; text: string }
  | { kind: "loaded"; sessions: AdminSessionSummary[] };

type Ending = { kind: "one"; session: AdminSessionSummary } | { kind: "others" } | null;

function SessionsSection({ version }: { version: number }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<SessionsState>({ kind: "loading" });
  const [ending, setEnding] = useState<Ending>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const copy = t.security.sessions;

  const loadFailed = useCallback(
    (error: unknown) => {
      if (!isSessionLoss(error)) {
        setState({ kind: "failed", text: generalErrorCopy(error, t) });
      }
    },
    [t],
  );

  /** Reload on request; a read, so it is always safe to repeat. */
  const load = async () => {
    setState({ kind: "loading" });

    try {
      setState({ kind: "loaded", sessions: await accountApi.listSessions() });
    } catch (error) {
      loadFailed(error);
    }
  };

  // On arrival and after a password change (version): the list as Laravel has it now.
  useEffect(() => {
    const controller = new AbortController();
    accountApi.listSessions(controller.signal).then(
      (sessions) => setState({ kind: "loaded", sessions }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          loadFailed(error);
        }
      },
    );

    return () => controller.abort();
  }, [loadFailed, version]);

  const end = async () => {
    if (inFlight.current || ending === null) {
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setMessage(null);

    try {
      if (ending.kind === "one") {
        await accountApi.endSession(ending.session.id);
        setMessage({ tone: "success", text: copy.ended });
      } else {
        const result = await accountApi.endOtherSessions();
        setMessage({ tone: "success", text: copy.endedAll(result.other_sessions_ended) });
      }

      await load();
    } catch (error) {
      if (isAdminApiError(error) && error.kind === "not-found") {
        setMessage({ tone: "info", text: copy.alreadyGone });
        await load();
      } else {
        setMessage(errorMessage(error, t, copy.uncertain));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
      setEnding(null);
    }
  };

  const others =
    state.kind === "loaded" ? state.sessions.filter((session) => !session.current) : [];

  return (
    <section aria-labelledby="sessions-title" className="grid gap-6 border-t border-line pt-8">
      <SectionHeading id="sessions-title" title={copy.title} body={copy.body} />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {state.kind === "loading" ? <LoadingState label={copy.loading} rows={3} /> : null}
      {state.kind === "failed" ? (
        <ErrorState title={copy.loadFailed} retryLabel={t.common.retry} onRetry={() => void load()}>
          {state.text}
        </ErrorState>
      ) : null}

      {state.kind === "loaded" ? (
        <>
          <ul className="grid gap-3">
            {state.sessions.map((session) => (
              <li
                key={session.id}
                className="grid gap-3 rounded-[1.25rem] border border-line bg-paper-raised px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p
                    id={`session-${session.id}`}
                    className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-ink"
                  >
                    <span>{deviceLabel(session.user_agent) ?? copy.unknownDevice}</span>
                    {session.current ? (
                      <span className="inline-flex items-center gap-2 text-meta font-semibold text-accent-text">
                        <span
                          aria-hidden
                          className="h-1.5 w-4 -rotate-[33deg] rounded-full bg-accent"
                        />
                        {copy.current}
                      </span>
                    ) : null}
                  </p>
                  <dl className="grid min-w-0 gap-x-6 gap-y-1 text-[0.9375rem] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <dt className="text-ink-muted">{copy.lastActive}</dt>
                    <dd className="text-ink">
                      {formatDateTime(session.last_active_at, locale) ?? t.common.notRecorded}
                    </dd>
                    <dt className="text-ink-muted">{copy.ipAddress}</dt>
                    <dd className="text-ink tabular-nums">
                      {session.ip_address ?? t.common.notRecorded}
                    </dd>
                    <dt className="text-ink-muted">{copy.browser}</dt>
                    <dd
                      className="line-clamp-2 text-meta break-words text-ink-muted"
                      title={session.user_agent ?? undefined}
                    >
                      {session.user_agent ?? t.common.notRecorded}
                    </dd>
                  </dl>
                </div>
                {session.current ? null : (
                  <Button
                    variant="danger"
                    className="justify-self-start"
                    aria-describedby={`session-${session.id}`}
                    onClick={() => setEnding({ kind: "one", session })}
                  >
                    {copy.end}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {others.length === 0 ? (
            <p className="text-[0.9375rem] text-ink-muted">{copy.none}</p>
          ) : (
            <div>
              <Button variant="danger" onClick={() => setEnding({ kind: "others" })}>
                {copy.endAll}
              </Button>
            </div>
          )}
          <div>
            <Button
              variant="quiet"
              className="-ml-5"
              icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
              onClick={() => void load()}
            >
              {copy.refresh}
            </Button>
          </div>
        </>
      ) : null}

      <Dialog
        open={ending !== null}
        title={ending?.kind === "others" ? copy.endAllTitle : copy.endTitle}
        description={ending?.kind === "others" ? copy.endAllBody : copy.endBody}
        onClose={() => (busy ? undefined : setEnding(null))}
        actions={
          <>
            <Button variant="quiet" onClick={() => setEnding(null)} data-autofocus>
              {t.common.cancel}
            </Button>
            <Button variant="danger" busy={busy} busyLabel={copy.ending} onClick={() => void end()}>
              {ending?.kind === "others" ? copy.endAll : copy.end}
            </Button>
          </>
        }
      />
    </section>
  );
}
