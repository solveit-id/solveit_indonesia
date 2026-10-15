import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { siteConfig } from "~/config/site";
import { company, primaryWhatsApp } from "~/data/company";
import { isServiceId } from "~/data/services";
import { useHydrated } from "~/hooks/use-hydrated";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { getServices } from "~/services/content";
import {
  budgetValues,
  type ComposedChannel,
  composeInquiryMessage,
  emptyInquiry,
  inquiryFields,
  inquiryHref,
  sameInquiry,
  timelineValues,
  validateInquiry,
  whatsappUrl,
} from "~/services/inquiry";
import {
  keepsSubmission,
  type LogicalSubmission,
  nextSubmission,
  submitInquiry,
} from "~/services/inquiry-api";
import type { InquiryErrors, InquiryPayload } from "~/types/inquiry";

type NotSentReason =
  | "blocked"
  | "too-large"
  | "rate-limited"
  | "unavailable"
  | "key-rejected"
  | "conflict"
  | "no-key"
  | "failed";

type Status =
  | { kind: "idle" }
  | { kind: "invalid"; count: number; fromServer?: boolean }
  | { kind: "opened"; channel: ComposedChannel; href: string; message: string }
  /** The previous feedback stays (dimmed) while sending, so nothing jumps. */
  | { kind: "submitting"; previous: Status }
  /** `sent` is what the server stored, so later edits can be flagged as unsent. */
  | { kind: "received"; reference: string; sent: InquiryPayload; replayed: boolean }
  | { kind: "not-sent"; reason: NotSentReason; minutes: number | null }
  /** `sent` is what the unconfirmed attempt carried; only that content may retry with its key. */
  | { kind: "uncertain"; sent: InquiryPayload };

const minutesFrom = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));
/** Clock reads for the Retry-After wait; only called from event handlers. */
const timestampAfter = (seconds: number) => Date.now() + seconds * 1000;
const secondsUntil = (timestamp: number) => (timestamp - Date.now()) / 1000;

/** A titled block of related fields; the index capsule echoes the process rail. */
function FormGroup({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="form-group">
      <h3 id={titleId} className="form-group-title">
        <span aria-hidden className="form-group-index">
          {index}
        </span>
        {title}
      </h3>
      <div className="grid gap-6">{children}</div>
    </div>
  );
}

/**
 * A native <select> in a capsule field with its own caret well. Browsers
 * that support customizable selects (`appearance: base-select`) also get a
 * styled, animated option list; the rest keep their native popup, which
 * stays the most reliable on phones. Keyboard, typeahead, and screen reader
 * behaviour are the browser's own in both cases.
 */
function SelectField({ children }: { children: ReactNode }) {
  return (
    <div className="select-field">
      {children}
      <span aria-hidden className="select-caret">
        <CaretDown weight="bold" className="size-3.5" />
      </span>
    </div>
  );
}

export function InquiryForm() {
  const { t, locale } = useI18n();
  const copy = t.form;
  const api = copy.api;
  // Fixed at build time: a default build has no website channel at all.
  const apiUrl = siteConfig.inquiryApiUrl;
  const id = `inq${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [params] = useSearchParams();
  const [values, setValues] = useState<InquiryPayload>(emptyInquiry);
  const [recipient, setRecipient] = useState<string>(primaryWhatsApp.e164);
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Set synchronously, so a second click before React re-renders cannot
  // start another POST; the request is aborted if the form unmounts.
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  // The logical website submission (idempotency key and the values sent with
  // it). Memory only: never stored in the browser, logged, or put in a URL.
  const submission = useRef<LogicalSubmission | null>(null);
  // Until when the server asked us to wait (Retry-After), as a timestamp.
  const waitUntil = useRef(0);
  const services = getServices(locale);

  // Prefill the service chosen in the hero or on the services page. Only after
  // hydration, so the prerendered markup (no query string) and the client match.
  const hydrated = useHydrated();
  const preset = params.get("layanan") ?? params.get("service");
  const payload: InquiryPayload = {
    ...values,
    service: values.service || (hydrated && isServiceId(preset) ? preset : ""),
  };

  // Anything typed into the prerendered form before React took over is kept:
  // hydration starts with empty state, so adopt the values already in the DOM.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const typed = new FormData(form);
    const text = (key: "name" | "organization" | "contact" | "message") =>
      String(typed.get(key) ?? "");
    setValues((current) => ({
      ...current,
      name: current.name || text("name"),
      organization: current.organization || text("organization"),
      contact: current.contact || text("contact"),
      message: current.message || text("message"),
    }));
  }, []);

  useEffect(() => {
    if (status.kind !== "idle" && status.kind !== "submitting") statusRef.current?.focus();
  }, [status]);

  useEffect(() => () => request.current?.abort(), []);

  const update = <K extends keyof InquiryPayload>(key: K, value: InquiryPayload[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const notSentText: Record<Exclude<NotSentReason, "rate-limited">, string> = {
    blocked: api.blocked,
    "too-large": api.tooLarge,
    unavailable: api.unavailable,
    "key-rejected": api.keyRejected,
    conflict: api.conflict,
    "no-key": api.unsupported,
    failed: api.failed,
  };

  const submitting = status.kind === "submitting";
  // After a confirmed receipt the same details cannot be sent again by
  // accident; any edit makes the form sendable (and the receipt says so).
  const unchangedSinceReceipt = status.kind === "received" && sameInquiry(payload, status.sent);
  const shown = status.kind === "submitting" ? status.previous : status;

  const sendThroughWebsite = async (endpoint: string, values: InquiryPayload) => {
    const wait = secondsUntil(waitUntil.current);
    if (wait > 0) {
      // Repeat the server's answer instead of asking again too early.
      setStatus({ kind: "not-sent", reason: "rate-limited", minutes: minutesFrom(wait) });
      return;
    }
    // Same content as the held submission: a retry with its key. Otherwise a
    // new logical submission with a new key.
    const current = nextSubmission(submission.current, values);
    if (!current) {
      setStatus({ kind: "not-sent", reason: "no-key", minutes: null });
      return;
    }
    submission.current = current;
    const { sent } = current;
    pending.current = true;
    const controller = new AbortController();
    request.current = controller;
    // An outdated "fields missing" summary is not kept: it would be wrong.
    setStatus((previous) => ({
      kind: "submitting",
      previous: previous.kind === "invalid" ? { kind: "idle" } : previous,
    }));
    const homepage = String(new FormData(formRef.current ?? undefined).get("homepage") ?? "");
    const result = await submitInquiry(endpoint, current, homepage, {
      signal: controller.signal,
    });
    // Unmounted, or superseded: drop the answer.
    if (request.current !== controller || controller.signal.aborted) return;
    request.current = null;
    pending.current = false;
    if (!keepsSubmission(result) && submission.current === current) submission.current = null;
    switch (result.kind) {
      case "accepted":
        setStatus({
          kind: "received",
          reference: result.reference,
          sent,
          replayed: result.replayed,
        });
        return;
      case "invalid": {
        // Localized text for each field the server named; the visitor's
        // values stay in place.
        const local = validateInquiry(sent, locale);
        const next: InquiryErrors = {};
        for (const key of result.fields) next[key] = local[key] ?? copy.errors.server;
        setErrors(next);
        setStatus({ kind: "invalid", count: result.fields.length, fromServer: true });
        return;
      }
      case "uncertain":
        setStatus({ kind: "uncertain", sent });
        return;
      case "rate-limited": {
        const seconds = result.retryAfterSeconds;
        if (seconds !== null) waitUntil.current = timestampAfter(seconds);
        const minutes = seconds === null ? null : minutesFrom(seconds);
        setStatus({ kind: "not-sent", reason: "rate-limited", minutes });
        return;
      }
      default:
        setStatus({ kind: "not-sent", reason: result.kind, minutes: null });
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const nextErrors = validateInquiry(payload, locale);
    setErrors(nextErrors);
    const invalid = inquiryFields.filter((key) => nextErrors[key]);
    if (invalid.length > 0) {
      setStatus({ kind: "invalid", count: invalid.length });
      return;
    }
    if (submitter?.value === "api") {
      if (apiUrl && !unchangedSinceReceipt) void sendThroughWebsite(apiUrl, payload);
      return;
    }
    const channel: ComposedChannel = submitter?.value === "email" ? "email" : "whatsapp";
    const href = inquiryHref(channel, payload, { locale, recipient });
    if (channel === "whatsapp") window.open(href, "_blank", "noopener,noreferrer");
    else window.location.assign(href);
    setCopied(false);
    setStatus({ kind: "opened", channel, href, message: composeInquiryMessage(payload, locale) });
  };

  // Switching the WhatsApp number after opening keeps the same composed
  // message: the "open again" link always targets the number selected now.
  const reopenHref =
    shown.kind === "opened"
      ? shown.channel === "whatsapp"
        ? whatsappUrl(recipient, shown.message)
        : shown.href
      : "";

  const copyMessage = async () => {
    if (shown.kind !== "opened") return;
    try {
      await navigator.clipboard.writeText(shown.message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const describe = (key: keyof InquiryPayload, hint?: boolean) =>
    [hint ? `${id}-${key}-hint` : null, errors[key] ? `${id}-${key}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const error = (key: keyof InquiryPayload) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="field-error">
        {errors[key]}
      </p>
    ) : null;

  const required = (
    <span aria-hidden className="text-accent-text">
      {" "}
      *
    </span>
  );
  const optional = <span className="font-normal text-ink-muted"> ({copy.optional})</span>;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="grid gap-10"
      aria-describedby={`${id}-intro`}
    >
      <p id={`${id}-intro`} className="max-w-[60ch] text-[0.95rem] text-ink-muted">
        {apiUrl ? api.intro : copy.intro}
      </p>

      {/* Honeypot for the website channel (docs/api/inquiries.md): out of
          sight, out of the tab order, hidden from assistive technology. */}
      {apiUrl && (
        <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor={`${id}-homepage`}>Homepage</label>
          <input id={`${id}-homepage`} name="homepage" tabIndex={-1} autoComplete="off" />
        </div>
      )}

      {shown.kind !== "idle" && shown.kind !== "submitting" && (
        <div
          ref={statusRef}
          tabIndex={-1}
          role={shown.kind === "opened" || shown.kind === "received" ? "status" : "alert"}
          className={cn(
            "rounded-[var(--radius-field)] border p-6 outline-none",
            shown.kind === "invalid" || shown.kind === "not-sent"
              ? "border-danger bg-danger/5"
              : shown.kind === "uncertain"
                ? "border-line-strong bg-paper-sunken"
                : "border-accent bg-accent/5",
            submitting && "opacity-60",
          )}
        >
          {shown.kind === "invalid" ? (
            <>
              <p className="font-semibold">
                {shown.fromServer ? api.invalid(shown.count) : copy.invalid(shown.count)}
              </p>
              <ul className="mt-2 list-disc pl-5 text-ink-muted">
                {inquiryFields
                  .filter((key) => errors[key])
                  .map((key) => (
                    <li key={key}>
                      <a href={`#${id}-${key}`} className="underline">
                        {errors[key]}
                      </a>
                    </li>
                  ))}
              </ul>
            </>
          ) : shown.kind === "received" ? (
            <>
              <p className="font-semibold">{api.received}</p>
              <dl className="mt-3">
                <dt className="text-[0.875rem] text-ink-muted">{api.reference}</dt>
                <dd className="mt-1 text-[1.25rem] font-semibold tracking-wide tabular-nums select-all">
                  {shown.reference}
                </dd>
              </dl>
              {shown.replayed && <p className="mt-3 text-ink-muted">{api.replayed}</p>}
              <p className="mt-3 text-ink-muted">{api.receivedNext}</p>
              {!sameInquiry(payload, shown.sent) && <p className="mt-3 font-medium">{api.stale}</p>}
            </>
          ) : shown.kind === "not-sent" ? (
            <>
              <p className="font-semibold">
                {shown.reason === "rate-limited"
                  ? api.rateLimited(shown.minutes)
                  : notSentText[shown.reason]}
              </p>
              <p className="mt-2 text-ink-muted">{api.kept}</p>
            </>
          ) : shown.kind === "uncertain" ? (
            <>
              <p className="font-semibold">{api.uncertain}</p>
              <p className="mt-2 text-ink-muted">{api.uncertainDetail}</p>
              <p className="mt-2 text-ink-muted">{api.kept}</p>
              {sameInquiry(payload, shown.sent) ? (
                // Same content, so the same key: the server answers with the
                // stored reference if the first attempt got through.
                <div className="mt-4">
                  <button
                    type="submit"
                    name="channel"
                    value="api"
                    disabled={!hydrated}
                    aria-disabled={submitting || undefined}
                    className="btn btn-secondary min-h-11"
                  >
                    {api.retry}
                  </button>
                </div>
              ) : (
                <p className="mt-3 font-medium">{api.uncertainChanged}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">
                {shown.channel === "whatsapp" ? copy.openedWhatsApp : copy.openedEmail}
              </p>
              <p className="mt-2 text-ink-muted">{copy.sendReminder(shown.channel)}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={reopenHref}
                  target={shown.channel === "whatsapp" ? "_blank" : undefined}
                  rel={shown.channel === "whatsapp" ? "noopener noreferrer" : undefined}
                  className="btn btn-secondary min-h-11"
                >
                  {copy.reopen}
                </a>
                <button type="button" onClick={copyMessage} className="btn btn-secondary min-h-11">
                  {copied ? copy.copied : copy.copy}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <FormGroup index={1} title={copy.groupYou}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="field">
            <label htmlFor={`${id}-name`} className="field-label">
              {copy.name}
              {required}
            </label>
            <input
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              className="field-input"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describe("name")}
              required
            />
            {error("name")}
          </div>
          <div className="field">
            <label htmlFor={`${id}-organization`} className="field-label">
              {copy.organization}
              {optional}
            </label>
            <input
              id={`${id}-organization`}
              name="organization"
              autoComplete="organization"
              className="field-input"
              value={values.organization}
              onChange={(event) => update("organization", event.target.value)}
              aria-invalid={Boolean(errors.organization)}
              aria-describedby={describe("organization")}
            />
            {error("organization")}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${id}-contact`} className="field-label">
            {copy.contact}
            {required}
          </label>
          <p id={`${id}-contact-hint`} className="field-hint">
            {copy.contactHint}
          </p>
          <input
            id={`${id}-contact`}
            name="contact"
            inputMode="email"
            autoComplete="email"
            className="field-input md:max-w-[calc(50%-0.75rem)]"
            value={values.contact}
            onChange={(event) => update("contact", event.target.value)}
            aria-invalid={Boolean(errors.contact)}
            aria-describedby={describe("contact", true)}
            required
          />
          {error("contact")}
        </div>
      </FormGroup>

      <FormGroup index={2} title={copy.groupProject}>
        <fieldset className="field" aria-describedby={describe("service")}>
          <legend id={`${id}-service`} tabIndex={-1} className="field-label outline-none">
            {copy.service}
            {required}
          </legend>
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <label key={service.id} className="choice">
                <input
                  type="radio"
                  name="service"
                  value={service.id}
                  checked={payload.service === service.id}
                  onChange={() => update("service", service.id)}
                />
                <span>{service.shortName}</span>
              </label>
            ))}
          </div>
          {error("service")}
        </fieldset>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="field">
            <label htmlFor={`${id}-budget`} className="field-label">
              {copy.budget}
            </label>
            <SelectField>
              <select
                id={`${id}-budget`}
                name="budget"
                className="field-input field-select"
                value={values.budget}
                onChange={(event) =>
                  update("budget", event.target.value as InquiryPayload["budget"])
                }
                aria-invalid={Boolean(errors.budget)}
                aria-describedby={describe("budget")}
              >
                {budgetValues.map((value) => (
                  <option key={value} value={value}>
                    {copy.budgetOptions[value]}
                  </option>
                ))}
              </select>
            </SelectField>
            {error("budget")}
          </div>
          <div className="field">
            <label htmlFor={`${id}-timeline`} className="field-label">
              {copy.timeline}
            </label>
            <SelectField>
              <select
                id={`${id}-timeline`}
                name="timeline"
                className="field-input field-select"
                value={values.timeline}
                onChange={(event) =>
                  update("timeline", event.target.value as InquiryPayload["timeline"])
                }
                aria-invalid={Boolean(errors.timeline)}
                aria-describedby={describe("timeline")}
              >
                {timelineValues.map((value) => (
                  <option key={value} value={value}>
                    {copy.timelineOptions[value]}
                  </option>
                ))}
              </select>
            </SelectField>
            {error("timeline")}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${id}-message`} className="field-label">
            {copy.message}
            {required}
          </label>
          <p id={`${id}-message-hint`} className="field-hint">
            {copy.messageHint}
          </p>
          <textarea
            id={`${id}-message`}
            name="message"
            rows={6}
            className="field-input"
            value={values.message}
            onChange={(event) => update("message", event.target.value)}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={describe("message", true)}
            required
          />
          {error("message")}
        </div>
      </FormGroup>

      <FormGroup index={3} title={copy.groupSend}>
        {apiUrl && (
          <div className="grid gap-3">
            <p id={`${id}-api-hint`} className="field-hint">
              {api.hint}
            </p>
            <div data-floating-avoid className="flex flex-col sm:flex-row">
              {/* aria-disabled rather than disabled while sending, so focus
                  stays on the button; the ref guard blocks repeats. */}
              <button
                type="submit"
                name="channel"
                value="api"
                disabled={!hydrated || unchangedSinceReceipt}
                aria-disabled={submitting || undefined}
                aria-busy={submitting || undefined}
                aria-describedby={`${id}-api-hint`}
                className="btn btn-primary btn-slice"
              >
                {submitting ? (
                  <CircleNotch
                    aria-hidden
                    weight="bold"
                    className="size-5 motion-safe:animate-spin"
                  />
                ) : (
                  <PaperPlaneTilt aria-hidden weight="bold" className="size-5" />
                )}
                {submitting ? api.sending : api.send}
              </button>
            </div>
            <p role="status" className="sr-only">
              {submitting ? api.submitting : ""}
            </p>
          </div>
        )}

        {/* A quiet divider: everything below belongs to the visitor's own
            WhatsApp or email, including the number picker. */}
        {apiUrl && (
          <h4 className="border-t border-line pt-6 text-[0.875rem] font-semibold text-ink-muted">
            {api.manualTitle}
          </h4>
        )}

        <fieldset className="field" aria-describedby={`${id}-recipient-hint`}>
          <legend className="field-label">{copy.recipient}</legend>
          <p id={`${id}-recipient-hint`} className="field-hint">
            {apiUrl ? api.recipientHint : copy.recipientHint}
          </p>
          <div className="flex flex-wrap gap-2">
            {company.whatsapp.map((number) => (
              <label key={number.e164} className="choice">
                <input
                  type="radio"
                  name="recipient"
                  value={number.e164}
                  checked={recipient === number.e164}
                  onChange={() => setRecipient(number.e164)}
                />
                <span className="tabular-nums">
                  <WhatsappLogo aria-hidden weight="bold" className="size-4" />
                  {number.display}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Disabled until hydrated: before that a click would make the browser
            submit natively and put the visitor's details in the URL. */}
        {/* Floating controls step aside while these buttons are near the
            bottom of the screen (see FloatingDock). */}
        <div data-floating-avoid className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            name="channel"
            value="whatsapp"
            disabled={!hydrated}
            aria-disabled={submitting || undefined}
            className={cn("btn btn-slice", apiUrl ? "btn-secondary" : "btn-primary")}
          >
            <WhatsappLogo aria-hidden className="size-5" weight="bold" />
            {copy.sendWhatsApp}
          </button>
          <button
            type="submit"
            name="channel"
            value="email"
            disabled={!hydrated}
            aria-disabled={submitting || undefined}
            className="btn btn-secondary btn-slice"
          >
            <EnvelopeSimple aria-hidden className="size-5" weight="bold" />
            {copy.sendEmail}
          </button>
        </div>
      </FormGroup>
    </form>
  );
}
