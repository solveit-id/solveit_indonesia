import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { generalErrorCopy, isUncertain } from "~/auth/error-copy";
import { readSignInNotice, safeReturnTo } from "~/auth/return-to";
import { markVerified } from "~/auth/session";
import { Button } from "~/components/ui/button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { PasswordField } from "~/components/ui/password-field";
import { StepTrack } from "~/components/ui/step-track";
import { TextField } from "~/components/ui/text-field";
import { useI18n } from "~/i18n/i18n";
import { normaliseTotp } from "~/lib/password-policy";
import { retryAt, useSecondsUntil } from "~/lib/time";
import { accountApi, isAdminApiError, isExpiredSignIn } from "~/services/admin-api";

type Method = "totp" | "recovery";

type Step = { kind: "password" } | { kind: "code"; email: string; method: Method };

interface Message {
  tone: NoticeTone;
  text: string;
  /** Offer a read-only session check (GET me) instead of resending a write. */
  checkSession?: boolean;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

/**
 * Sign-in in two steps (docs/api/admin-auth.md): `POST auth/login`, then
 * `POST auth/two-factor-challenge` with a TOTP or recovery code. A correct password alone
 * signs nobody in, so the console shows nothing private until the challenge returns 204 and a
 * following `GET me` verifies the account. Values typed here live in component state only,
 * are cleared as soon as they have been sent, and are never logged or stored.
 *
 * Nothing is resent automatically except what the API client does after a 419 for these two
 * allowlisted steps. A timeout, network failure, 5xx, or unreadable answer is reported as
 * uncertain; after the challenge the person checks the session (a read) before trying again.
 */
export function SignIn() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("kembali"));
  const arrivalNotice = readSignInNotice(searchParams.get("alasan"));

  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<{ field: string; text: string } | null>(null);
  const [message, setMessage] = useState<Message | null>(
    arrivalNotice ? { tone: "info", text: t.signIn.notices[arrivalNotice] } : null,
  );
  const [busy, setBusy] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const waitSeconds = useSecondsUntil(blockedUntil);
  const inFlight = useRef(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // A step change lands focus on the field to fill in: the code, or the password again after
  // an expired attempt. Its label and hint name the step for assistive technology.
  const method = step.kind === "code" ? step.method : null;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;

      return;
    }

    (method === null ? passwordRef : codeRef).current?.focus();
  }, [method]);

  const blocked = waitSeconds > 0;

  /** Rate limits get the bounded countdown; everything else the general copy. */
  const failWith = (error: unknown) => {
    if (isAdminApiError(error) && error.kind === "rate-limited") {
      setBlockedUntil(retryAt(error.retryAfterSeconds));
      setMessage(null);
    } else {
      setMessage({ tone: "danger", text: generalErrorCopy(error, t) });
    }
  };

  /** `GET me`, then into the console. Used after a 204, a 409, and for the session check. */
  const enter = async (): Promise<"entered" | "not-signed-in" | "unverified"> => {
    try {
      markVerified(await accountApi.me());
      navigate(returnTo, { replace: true });

      return "entered";
    } catch (error) {
      return isAdminApiError(error) && error.kind === "unauthenticated"
        ? "not-signed-in"
        : "unverified";
    }
  };

  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || blocked) {
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

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();

    if (address === "") {
      setFieldError({ field: "email", text: t.signIn.emailMissing });
      emailRef.current?.focus();

      return;
    }

    if (!EMAIL_SHAPE.test(address)) {
      setFieldError({ field: "email", text: t.signIn.emailInvalid });
      emailRef.current?.focus();

      return;
    }

    if (password === "") {
      setFieldError({ field: "password", text: t.signIn.passwordMissing });
      passwordRef.current?.focus();

      return;
    }

    setFieldError(null);

    void run(async () => {
      setMessage(null);

      try {
        await accountApi.login(address, password);
        setPassword("");
        setCode("");
        setStep({ kind: "code", email: address, method: "totp" });
      } catch (error) {
        if (isAdminApiError(error) && error.kind === "conflict") {
          // Already signed in (another tab finished first): verify, then enter.
          setPassword("");
          const result = await enter();

          if (result !== "entered") {
            setMessage({ tone: "danger", text: t.signIn.sessionUnverified, checkSession: true });
          }

          return;
        }

        if (isAdminApiError(error) && error.kind === "validation") {
          // Identical for a wrong password, an unknown address, and an account that may not
          // sign in: Laravel never says which (admin-auth.md).
          setPassword("");
          setMessage({ tone: "danger", text: t.signIn.rejected });
          passwordRef.current?.focus();

          return;
        }

        if (isUncertain(error)) {
          setPassword("");
          setMessage({ tone: "danger", text: t.signIn.passwordUncertain });

          return;
        }

        failWith(error);
      }
    });
  };

  const backToPassword = (notice: Message | null) => {
    setCode("");
    setFieldError(null);
    setMessage(notice);
    setStep({ kind: "password" });
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();

    if (step.kind !== "code") {
      return;
    }

    const answer = step.method === "totp" ? normaliseTotp(code) : code.trim();

    if (answer === null || answer === "") {
      setFieldError({
        field: "code",
        text: step.method === "totp" ? t.signIn.codeFormat : t.signIn.recoveryMissing,
      });
      codeRef.current?.focus();

      return;
    }

    setFieldError(null);

    void run(async () => {
      setMessage(null);

      try {
        await accountApi.answerChallenge(
          step.method === "totp" ? { code: answer } : { recovery_code: answer },
        );
        setCode("");
        const result = await enter();

        if (result === "not-signed-in") {
          backToPassword({ tone: "warning", text: t.signIn.expired });
        } else if (result === "unverified") {
          setMessage({ tone: "danger", text: t.signIn.sessionUnverified, checkSession: true });
        }
      } catch (error) {
        if (isExpiredSignIn(error)) {
          // The pending sign-in is gone (also after the client's one 419 replay): this is not
          // a wrong code. Start again at the password.
          backToPassword({ tone: "warning", text: t.signIn.expired });

          return;
        }

        if (isAdminApiError(error) && error.kind === "validation") {
          setCode("");
          setFieldError({
            field: "code",
            text: step.method === "totp" ? t.signIn.wrongCode : t.signIn.wrongRecovery,
          });
          codeRef.current?.focus();

          return;
        }

        if (isAdminApiError(error) && error.kind === "conflict") {
          const result = await enter();

          if (result !== "entered") {
            setMessage({ tone: "danger", text: t.signIn.sessionUnverified, checkSession: true });
          }

          return;
        }

        if (isUncertain(error)) {
          setCode("");
          setMessage({ tone: "danger", text: t.signIn.codeUncertain, checkSession: true });

          return;
        }

        failWith(error);
      }
    });
  };

  const checkSession = () =>
    void run(async () => {
      const result = await enter();

      if (result === "not-signed-in") {
        setMessage({ tone: "info", text: t.signIn.notSignedInYet });
        codeRef.current?.focus();
      } else if (result === "unverified") {
        setMessage({ tone: "danger", text: t.signIn.sessionUnverified, checkSession: true });
      }
    });

  const switchMethod = () => {
    if (step.kind !== "code") {
      return;
    }

    setCode("");
    setFieldError(null);
    setMessage(null);
    setStep({ ...step, method: step.method === "totp" ? "recovery" : "totp" });
  };

  const onCodeStep = step.kind === "code";

  return (
    <article className="max-w-[34rem]">
      <StepTrack label={t.signIn.stepsLabel} steps={t.signIn.steps} current={onCodeStep ? 1 : 0} />

      <h1 className="mt-8 text-page font-wide">
        {onCodeStep ? t.signIn.codeTitle : t.signIn.title}
      </h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">
        {step.kind === "code" ? t.signIn.codeLede(step.email) : t.signIn.lede}
      </p>

      <div className="mt-8 grid gap-4">
        {message ? (
          <Notice
            tone={message.tone}
            action={
              message.checkSession ? (
                <Button busy={busy} busyLabel={t.signIn.verifying} onClick={checkSession}>
                  {t.signIn.checkSession}
                </Button>
              ) : null
            }
          >
            {message.text}
          </Notice>
        ) : null}
        {blocked ? <Notice tone="warning">{t.errors.rateLimited(waitSeconds)}</Notice> : null}
      </div>

      {step.kind === "password" ? (
        <form noValidate onSubmit={submitPassword} className="mt-6 grid gap-6">
          <TextField
            ref={emailRef}
            label={t.signIn.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError?.field === "email" ? fieldError.text : undefined}
          />
          <PasswordField
            ref={passwordRef}
            label={t.signIn.password}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldError?.field === "password" ? fieldError.text : undefined}
          />
          <div>
            <Button
              type="submit"
              variant="primary"
              busy={busy}
              busyLabel={t.signIn.checking}
              aria-disabled={blocked || undefined}
              icon={<ArrowRight aria-hidden size={18} weight="bold" />}
            >
              {t.signIn.continue}
            </Button>
          </div>
        </form>
      ) : (
        <form noValidate onSubmit={submitCode} className="mt-6 grid gap-6">
          {step.method === "totp" ? (
            <TextField
              key="totp"
              ref={codeRef}
              label={t.signIn.code}
              hint={t.signIn.codeHint}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              code
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={fieldError?.field === "code" ? fieldError.text : undefined}
            />
          ) : (
            <TextField
              key="recovery"
              ref={codeRef}
              label={t.signIn.recoveryCode}
              hint={t.signIn.recoveryHint}
              name="recovery_code"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              code
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={fieldError?.field === "code" ? fieldError.text : undefined}
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              busy={busy}
              busyLabel={t.signIn.verifying}
              aria-disabled={blocked || undefined}
            >
              {t.signIn.submit}
            </Button>
            <Button variant="quiet" onClick={switchMethod} aria-disabled={busy || undefined}>
              {step.method === "totp" ? t.signIn.useRecovery : t.signIn.useAuthenticator}
            </Button>
          </div>
          <div>
            <Button
              variant="quiet"
              className="-ml-5"
              icon={<ArrowLeft aria-hidden size={18} weight="bold" />}
              onClick={() => (busy ? undefined : backToPassword(null))}
            >
              {t.signIn.changeAccount}
            </Button>
          </div>
        </form>
      )}

      <section aria-labelledby="sign-in-help" className="mt-12 border-t border-line pt-6">
        <h2 id="sign-in-help" className="text-item font-wide">
          {t.signIn.helpTitle}
        </h2>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">{t.signIn.helpAccounts}</p>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">{t.signIn.helpRecovery}</p>
      </section>
    </article>
  );
}
