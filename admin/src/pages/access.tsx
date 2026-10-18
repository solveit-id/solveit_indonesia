import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { type FormEvent, Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { generalErrorCopy, isUncertain } from "~/auth/error-copy";
import { markSignedOut, markVerified } from "~/auth/session";
import { RecoveryCodesReveal } from "~/components/account/recovery-codes-reveal";
import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { PasswordField } from "~/components/ui/password-field";
import { LoadingState } from "~/components/ui/state-view";
import { StepTrack } from "~/components/ui/step-track";
import { TextField } from "~/components/ui/text-field";
import { useI18n } from "~/i18n/i18n";
import type { Messages } from "~/i18n/messages/id";
import { peekHeldAccessLinkToken, releaseHeldAccessLinkToken } from "~/lib/access-link";
import { characterCount, newPasswordProblem, normaliseTotp } from "~/lib/password-policy";
import { formatDateTime, formatTime, retryAt, useSecondsUntil } from "~/lib/time";
import { paths } from "~/routes/paths";
import {
  type AdminAccessLinkInspection,
  type AdminAccessLinkPurpose,
  accountApi,
  isAdminApiError,
} from "~/services/admin-api";

type Phase =
  | { kind: "missing" }
  | { kind: "checking" }
  | { kind: "inspect-failed"; text: string }
  | { kind: "invalid" }
  | { kind: "signed-in" }
  | { kind: "form"; link: AdminAccessLinkInspection }
  | {
      kind: "enroll";
      purpose: AdminAccessLinkPurpose;
      qrSrc: string | null;
      setupKey: string;
      confirmBefore: string;
    }
  | { kind: "codes"; purpose: AdminAccessLinkPurpose; codes: string[] }
  | { kind: "active-without-codes" };

interface Message {
  tone: NoticeTone;
  text: string;
  action?: "check-link" | "check-account";
}

const NAME_MAX = 120;

/**
 * The QR code Laravel returns, as an image URL. An <img> never runs script inside an SVG, and
 * the CSP allows `data:` images for exactly this (security-policy.ts). Anything that is not an
 * SVG document is refused rather than shown; the manual key remains.
 */
export function svgDataUri(svg: string): string | null {
  const trimmed = svg.trim();

  return /^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(trimmed)
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`
    : null;
}

/** Groups of four for reading aloud and typing; copying uses the raw key. */
const keyGroups = (key: string) => key.match(/.{1,4}/g) ?? [];

/**
 * `/access#token=...` (docs/api/admin-auth.md, Pra-aktivasi). The token was taken out of the
 * address before the router started (main.tsx, src/lib/access-link.ts); this screen holds it
 * in component memory only and drops it once the link is used or refused. The link is
 * inspected on arrival (that does not use it) and redeemed only when the person submits the
 * form. The TOTP secret and the recovery codes likewise exist only in this component's state.
 */
export function Access() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => peekHeldAccessLinkToken());
  const [phase, setPhase] = useState<Phase>(() =>
    token === null ? { kind: "missing" } : { kind: "checking" },
  );
  const [message, setMessage] = useState<Message | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const waitSeconds = useSecondsUntil(blockedUntil);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // Only this component holds the token from now on.
  useEffect(() => releaseHeldAccessLinkToken(), []);

  // A new step starts at its heading: focus (and with it the scroll position) moves there, so
  // the person is not left at the button they pressed, and the step is announced.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownPhase = useRef(phase.kind);

  useEffect(() => {
    if (shownPhase.current !== phase.kind) {
      shownPhase.current = phase.kind;
      headingRef.current?.focus();
    }
  }, [phase.kind]);

  const inspectionFailed = useCallback(
    (error: unknown) => {
      if (isAdminApiError(error) && error.kind === "not-found") {
        setToken(null);
        setPhase({ kind: "invalid" });
      } else if (isAdminApiError(error) && error.kind === "conflict") {
        setPhase({ kind: "signed-in" });
      } else if (isAdminApiError(error) && error.kind === "rate-limited") {
        setBlockedUntil(retryAt(error.retryAfterSeconds));
        setPhase({ kind: "inspect-failed", text: "" });
      } else {
        setPhase({ kind: "inspect-failed", text: t.access.inspectFailed });
      }
    },
    [t],
  );

  /** Inspect again on request (retry, after signing out). Inspecting never uses the link. */
  const inspect = async (linkToken: string) => {
    setPhase({ kind: "checking" });

    try {
      setPhase({ kind: "form", link: await accountApi.inspectAccessLink(linkToken) });
    } catch (error) {
      inspectionFailed(error);
    }
  };

  // Inspect once on arrival; every later check is the person's explicit action.
  const arrivalToken = useRef(token);

  useEffect(() => {
    const linkToken = arrivalToken.current;

    if (linkToken === null) {
      return;
    }

    const controller = new AbortController();
    accountApi.inspectAccessLink(linkToken, controller.signal).then(
      (link) => setPhase({ kind: "form", link }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          inspectionFailed(error);
        }
      },
    );

    return () => controller.abort();
  }, [inspectionFailed]);

  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || waitSeconds > 0) {
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

  const purpose =
    phase.kind === "form"
      ? phase.link.purpose
      : phase.kind === "enroll" || phase.kind === "codes"
        ? phase.purpose
        : "activation";
  const isReset = purpose === "credential-reset";
  const stepIndex =
    phase.kind === "form" ? 1 : phase.kind === "enroll" ? 2 : phase.kind === "codes" ? 3 : 0;

  const title = (() => {
    switch (phase.kind) {
      case "missing":
        return t.access.missingTitle;
      case "invalid":
        return t.access.invalidTitle;
      case "signed-in":
        return t.access.signedInTitle;
      case "checking":
      case "inspect-failed":
        return t.access.checkingTitle;
      case "enroll":
        return t.enrollment.title;
      case "codes":
      case "active-without-codes":
        return isReset ? t.access.resetTitle : t.access.activationTitle;
      case "form":
        return isReset ? t.access.resetTitle : t.access.activationTitle;
    }
  })();

  const signOutAndContinue = () =>
    void run(async () => {
      try {
        await accountApi.logout();
      } catch (error) {
        if (!(isAdminApiError(error) && error.kind === "unauthenticated")) {
          setMessage({ tone: "danger", text: t.shell.signOutUncertain });

          return;
        }
      }

      markSignedOut("signed-out");
      setMessage(null);

      if (token !== null) {
        await inspect(token);
      } else {
        setPhase({ kind: "missing" });
      }
    });

  const checkLink = () =>
    void run(async () => {
      if (token === null) {
        return;
      }

      try {
        await accountApi.inspectAccessLink(token);
        setMessage({ tone: "info", text: t.access.stillValid });
      } catch (error) {
        if (isAdminApiError(error) && error.kind === "not-found") {
          setToken(null);
          setMessage(null);
          setPhase({ kind: "invalid" });
        } else {
          setMessage({ tone: "danger", text: generalErrorCopy(error, t), action: "check-link" });
        }
      }
    });

  const checkAccount = () =>
    void run(async () => {
      try {
        markVerified(await accountApi.me());
        // Enrollment did complete, but its one response with the codes was lost.
        setMessage(null);
        setPhase({ kind: "active-without-codes" });
      } catch (error) {
        if (isAdminApiError(error) && error.kind === "unauthenticated") {
          setMessage({ tone: "info", text: t.enrollment.notYet });
        } else {
          setMessage({ tone: "danger", text: generalErrorCopy(error, t), action: "check-account" });
        }
      }
    });

  return (
    <article className="max-w-[40rem]">
      {/* Only while the flow can still be completed: a failed link is not a step in progress. */}
      {phase.kind === "form" || phase.kind === "enroll" || phase.kind === "codes" ? (
        <StepTrack
          label={t.access.stepsLabel}
          steps={isReset ? t.access.resetSteps : t.access.steps}
          current={stepIndex}
        />
      ) : null}

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 text-page font-wide outline-none first:mt-0"
      >
        {title}
      </h1>

      {message ? (
        <Notice
          tone={message.tone}
          className="mt-8"
          action={
            message.action === "check-link" ? (
              <Button busy={busy} busyLabel={t.access.checking} onClick={checkLink}>
                {t.access.checkLink}
              </Button>
            ) : message.action === "check-account" ? (
              <Button busy={busy} busyLabel={t.access.checking} onClick={checkAccount}>
                {t.enrollment.checkAccount}
              </Button>
            ) : null
          }
        >
          {message.text}
        </Notice>
      ) : null}
      {waitSeconds > 0 ? (
        <Notice tone="warning" className="mt-4">
          {t.errors.rateLimited(waitSeconds)}
        </Notice>
      ) : null}

      <div className="mt-8">
        {phase.kind === "checking" ? <LoadingState label={t.access.checking} rows={3} /> : null}

        {phase.kind === "missing" || phase.kind === "invalid" ? (
          <>
            <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed text-ink-muted">
              {phase.kind === "missing" ? t.access.missingBody : t.access.invalidBody}
            </p>
            <NewLinkHelp t={t} />
          </>
        ) : null}

        {phase.kind === "inspect-failed" ? (
          <div className="grid gap-5">
            {phase.text ? <Notice tone="danger">{phase.text}</Notice> : null}
            <div>
              <Button
                variant="primary"
                aria-disabled={waitSeconds > 0 || undefined}
                onClick={() =>
                  token !== null && waitSeconds === 0 ? void inspect(token) : undefined
                }
              >
                {t.common.retry}
              </Button>
            </div>
          </div>
        ) : null}

        {phase.kind === "signed-in" ? (
          <div className="grid gap-5">
            <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed text-ink-muted">
              {t.access.signedInBody}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                busy={busy}
                busyLabel={t.shell.signingOut}
                icon={<SignOut aria-hidden size={18} weight="bold" />}
                onClick={signOutAndContinue}
              >
                {t.access.signOutAndContinue}
              </Button>
              <Link to={paths.home} className="btn btn-secondary">
                {t.access.toConsole}
              </Link>
            </div>
          </div>
        ) : null}

        {phase.kind === "form" && token !== null ? (
          <CredentialsForm
            link={phase.link}
            token={token}
            busy={busy}
            blocked={waitSeconds > 0}
            run={run}
            onMessage={setMessage}
            onRateLimited={(seconds) => setBlockedUntil(retryAt(seconds))}
            onRedeemed={(redemption) => {
              setToken(null);
              setMessage(null);
              setPhase({
                kind: "enroll",
                purpose: phase.link.purpose,
                qrSrc: svgDataUri(redemption.two_factor.qr_code_svg),
                setupKey: redemption.two_factor.setup_key,
                confirmBefore: redemption.confirm_before,
              });
            }}
            onInvalid={() => {
              setToken(null);
              setMessage(null);
              setPhase({ kind: "invalid" });
            }}
            onSignedIn={() => setPhase({ kind: "signed-in" })}
            locale={locale}
          />
        ) : null}

        {phase.kind === "enroll" ? (
          <EnrollmentStep
            phase={phase}
            busy={busy}
            blocked={waitSeconds > 0}
            run={run}
            onMessage={setMessage}
            onRateLimited={(seconds) => setBlockedUntil(retryAt(seconds))}
            onGone={() => {
              setMessage({ tone: "danger", text: t.enrollment.gone });
              setPhase({ kind: "invalid" });
            }}
            onConfirmed={(codes) => {
              setMessage(null);
              setPhase({ kind: "codes", purpose: phase.purpose, codes });
            }}
            locale={locale}
          />
        ) : null}

        {phase.kind === "codes" ? (
          <RecoveryCodesReveal
            codes={phase.codes}
            continueLabel={t.recoveryCodes.continueToConsole}
            onContinue={() => navigate(paths.home, { replace: true })}
          />
        ) : null}

        {phase.kind === "active-without-codes" ? (
          <div className="grid gap-5">
            <Notice tone="warning">{t.enrollment.activeWithoutCodes}</Notice>
            <div>
              <Link to={paths.security} replace className="btn btn-primary">
                {t.enrollment.toSecurity}
                <ArrowRight aria-hidden size={18} weight="bold" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function NewLinkHelp({ t }: { t: Messages }) {
  return (
    <section aria-labelledby="new-link-title" className="mt-10 border-t border-line pt-6">
      <h2 id="new-link-title" className="text-item font-wide">
        {t.access.newLinkTitle}
      </h2>
      <ul className="mt-3 grid max-w-[64ch] gap-2.5 text-[0.9375rem] text-ink-muted">
        {[t.access.newLinkInvitation, t.access.newLinkReset, t.access.newLinkServer].map((item) => (
          <li key={item} className="flex gap-3">
            <span
              aria-hidden
              className="mt-2.5 h-1 w-3 flex-none -rotate-[33deg] rounded-full bg-line-strong"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Run = (action: () => Promise<void>) => Promise<void>;

function CredentialsForm({
  link,
  token,
  busy,
  blocked,
  run,
  onMessage,
  onRateLimited,
  onRedeemed,
  onInvalid,
  onSignedIn,
  locale,
}: {
  link: AdminAccessLinkInspection;
  token: string;
  busy: boolean;
  blocked: boolean;
  run: Run;
  onMessage: (message: Message | null) => void;
  onRateLimited: (seconds: number | undefined) => void;
  onRedeemed: (redemption: Awaited<ReturnType<typeof accountApi.redeemAccessLink>>) => void;
  onInvalid: () => void;
  onSignedIn: () => void;
  locale: "id" | "en";
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "password" | "confirmation", string>>
  >({});
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const isReset = link.purpose === "credential-reset";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    const trimmedName = name.trim();

    if (link.requires_name && trimmedName === "") {
      next.name = t.access.nameMissing;
    } else if (link.requires_name && characterCount(trimmedName) > NAME_MAX) {
      next.name = t.access.nameTooLong;
    }

    const problem = newPasswordProblem(password, confirmation);

    if (problem === "too-short") {
      next.password = t.access.tooShort;
    } else if (problem === "too-long") {
      next.password = t.access.tooLong;
    } else if (problem === "mismatch") {
      next.confirmation = t.access.mismatch;
    }

    setErrors(next);

    if (next.name || next.password || next.confirmation) {
      (next.name ? nameRef : next.password ? passwordRef : confirmationRef).current?.focus();

      return;
    }

    void run(async () => {
      onMessage(null);

      try {
        const redemption = await accountApi.redeemAccessLink({
          token,
          ...(link.requires_name ? { name: trimmedName } : {}),
          password,
          password_confirmation: confirmation,
        });
        setPassword("");
        setConfirmation("");
        onRedeemed(redemption);
      } catch (error) {
        if (isAdminApiError(error) && error.kind === "validation") {
          // Validation failures do not use the link (admin-auth.md).
          const fields = error.fieldErrors;
          setErrors({
            name: fields.name ? t.access.nameMissing : undefined,
            password: fields.password ? t.access.serverRejectedPassword : undefined,
          });
          (fields.name ? nameRef : passwordRef).current?.focus();

          if (fields.token) {
            onInvalid();
          }

          return;
        }

        if (isAdminApiError(error) && error.kind === "not-found") {
          onInvalid();

          return;
        }

        if (isAdminApiError(error) && error.kind === "conflict") {
          onSignedIn();

          return;
        }

        if (isAdminApiError(error) && error.kind === "rate-limited") {
          onRateLimited(error.retryAfterSeconds);

          return;
        }

        if (isUncertain(error)) {
          onMessage({ tone: "danger", text: t.access.redeemUncertain, action: "check-link" });

          return;
        }

        onMessage({ tone: "danger", text: generalErrorCopy(error, t) });
      }
    });
  };

  const expires = formatDateTime(link.expires_at, locale);

  return (
    <div className="grid gap-8">
      <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed text-ink-muted">
        {isReset ? t.access.resetLede : t.access.activationLede}
      </p>

      <dl className="grid gap-x-8 gap-y-3 border-y border-line py-4 text-[0.9375rem] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-ink-muted">{t.access.forAccount}</dt>
        <dd className="font-semibold break-all text-ink">{link.email}</dd>
        {expires ? (
          <>
            <dt className="text-ink-muted">{t.access.validUntil}</dt>
            <dd className="text-ink">{expires}</dd>
          </>
        ) : null}
      </dl>

      <form noValidate onSubmit={submit} className="grid max-w-[30rem] gap-6">
        {/* Lets a password manager file the new password under the right account. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={link.email}
          readOnly
          hidden
        />
        {link.requires_name ? (
          <TextField
            ref={nameRef}
            label={t.access.name}
            hint={t.access.nameHint}
            name="name"
            autoComplete="name"
            maxLength={NAME_MAX + 20}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
        ) : null}
        <PasswordField
          ref={passwordRef}
          label={t.access.newPassword}
          hint={t.access.passwordHint}
          name="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
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
        <div className="grid gap-3">
          <p className="text-meta text-ink-muted">{t.access.submitNote}</p>
          <div>
            <Button
              type="submit"
              variant="primary"
              busy={busy}
              busyLabel={t.access.saving}
              aria-disabled={blocked || undefined}
              icon={<ArrowRight aria-hidden size={18} weight="bold" />}
            >
              {t.access.submit}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EnrollmentStep({
  phase,
  busy,
  blocked,
  run,
  onMessage,
  onRateLimited,
  onGone,
  onConfirmed,
  locale,
}: {
  phase: Extract<Phase, { kind: "enroll" }>;
  busy: boolean;
  blocked: boolean;
  run: Run;
  onMessage: (message: Message | null) => void;
  onRateLimited: (seconds: number | undefined) => void;
  onGone: () => void;
  onConfirmed: (codes: string[]) => void;
  locale: "id" | "en";
}) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const codeRef = useRef<HTMLInputElement>(null);
  const deadline = formatTime(phase.confirmBefore, locale);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const answer = normaliseTotp(code);

    if (answer === null) {
      setError(t.signIn.codeFormat);
      codeRef.current?.focus();

      return;
    }

    setError(undefined);

    void run(async () => {
      onMessage(null);

      try {
        const confirmation = await accountApi.confirmEnrollment(answer);
        setCode("");
        // Laravel signed the account in; its account data comes with the codes.
        markVerified({ account: confirmation.account, serverClockOffsetMs: 0 });
        onConfirmed(confirmation.recovery_codes);
        // Verify the new session with a read as well; the console home checks it again.
        accountApi.me().then(markVerified, () => undefined);
      } catch (failure) {
        if (isAdminApiError(failure) && failure.kind === "validation") {
          setCode("");
          setError(t.enrollment.wrongCode);
          codeRef.current?.focus();

          return;
        }

        if (isAdminApiError(failure) && failure.kind === "not-found") {
          onGone();

          return;
        }

        if (isAdminApiError(failure) && failure.kind === "rate-limited") {
          onRateLimited(failure.retryAfterSeconds);

          return;
        }

        if (isUncertain(failure) || (isAdminApiError(failure) && failure.kind === "conflict")) {
          // A 409 here means this browser is already signed in: the confirmation may have
          // gone through on an attempt whose answer never arrived.
          setCode("");
          onMessage({ tone: "danger", text: t.enrollment.uncertain, action: "check-account" });

          return;
        }

        onMessage({ tone: "danger", text: generalErrorCopy(failure, t) });
      }
    });
  };

  return (
    <div className="grid gap-8">
      <p className="max-w-[64ch] text-[1.0625rem] leading-relaxed text-ink-muted">
        {t.enrollment.lede}
      </p>

      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        {phase.qrSrc ? (
          <div className="justify-self-start rounded-panel border border-line bg-[#ffffff] p-4">
            <img
              src={phase.qrSrc}
              alt={t.enrollment.qrAlt}
              width={192}
              height={192}
              className="size-48"
            />
          </div>
        ) : null}
        <div className="grid min-w-0 gap-3">
          <h2 className="text-item font-wide">{t.enrollment.manualTitle}</h2>
          <p className="text-[0.9375rem] text-ink-muted">{t.enrollment.manualBody}</p>
          <p className="text-meta font-semibold text-ink-muted" id="setup-key-label">
            {t.enrollment.setupKey}
          </p>
          <p
            aria-labelledby="setup-key-label"
            className="rounded-[1.25rem] border border-line bg-paper-raised px-4 py-3 font-mono text-[1rem] tracking-wider text-ink select-all"
          >
            {/* A line may break between groups, never inside one. */}
            {keyGroups(phase.setupKey).map((group, index) => (
              <Fragment key={index}>
                {index > 0 ? " " : null}
                <span className="whitespace-nowrap">{group}</span>
              </Fragment>
            ))}
          </p>
          <div>
            <CopyButton value={phase.setupKey} label={t.enrollment.copyKey} />
          </div>
        </div>
      </div>

      <Notice tone="warning">
        {deadline ? `${t.enrollment.deadline(deadline)} ` : null}
        {t.enrollment.shownOnce}
      </Notice>

      <form noValidate onSubmit={submit} className="grid max-w-[30rem] gap-6">
        <TextField
          ref={codeRef}
          label={t.enrollment.code}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          code
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={error}
        />
        <div>
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            busyLabel={t.enrollment.confirming}
            aria-disabled={blocked || undefined}
          >
            {phase.purpose === "credential-reset"
              ? t.enrollment.submitReset
              : t.enrollment.submitActivation}
          </Button>
        </div>
      </form>
    </div>
  );
}
