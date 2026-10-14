import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { company, primaryWhatsApp } from "~/data/company";
import { isServiceId } from "~/data/services";
import { useHydrated } from "~/hooks/use-hydrated";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/cn";
import { getServices } from "~/services/content";
import {
  budgetValues,
  composeInquiryMessage,
  emptyInquiry,
  type InquiryChannel,
  inquiryHref,
  timelineValues,
  validateInquiry,
  whatsappUrl,
} from "~/services/inquiry";
import type { InquiryErrors, InquiryPayload } from "~/types/inquiry";

type Status =
  | { kind: "idle" }
  | { kind: "invalid"; count: number }
  | { kind: "opened"; channel: InquiryChannel; href: string; message: string };

const fieldOrder: (keyof InquiryPayload)[] = ["name", "contact", "service", "message"];

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
  const id = `inq${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [params] = useSearchParams();
  const [values, setValues] = useState<InquiryPayload>(emptyInquiry);
  const [recipient, setRecipient] = useState<string>(primaryWhatsApp.e164);
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
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
    if (status.kind !== "idle") statusRef.current?.focus();
  }, [status]);

  const update = <K extends keyof InquiryPayload>(key: K, value: InquiryPayload[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const channel: InquiryChannel = submitter?.value === "email" ? "email" : "whatsapp";
    const nextErrors = validateInquiry(payload, locale);
    setErrors(nextErrors);
    const invalid = fieldOrder.filter((key) => nextErrors[key]);
    if (invalid.length > 0) {
      setStatus({ kind: "invalid", count: invalid.length });
      return;
    }
    const href = inquiryHref(channel, payload, { locale, recipient });
    if (channel === "whatsapp") window.open(href, "_blank", "noopener,noreferrer");
    else window.location.href = href;
    setCopied(false);
    setStatus({ kind: "opened", channel, href, message: composeInquiryMessage(payload, locale) });
  };

  // Switching the WhatsApp number after opening keeps the same composed
  // message: the "open again" link always targets the number selected now.
  const reopenHref =
    status.kind === "opened"
      ? status.channel === "whatsapp"
        ? whatsappUrl(recipient, status.message)
        : status.href
      : "";

  const copyMessage = async () => {
    if (status.kind !== "opened") return;
    try {
      await navigator.clipboard.writeText(status.message);
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
        {copy.intro}
      </p>

      {status.kind !== "idle" && (
        <div
          ref={statusRef}
          tabIndex={-1}
          role={status.kind === "invalid" ? "alert" : "status"}
          className={cn(
            "rounded-[var(--radius-field)] border p-6 outline-none",
            status.kind === "invalid" ? "border-danger bg-danger/5" : "border-accent bg-accent/5",
          )}
        >
          {status.kind === "invalid" ? (
            <>
              <p className="font-semibold">{copy.invalid(status.count)}</p>
              <ul className="mt-2 list-disc pl-5 text-ink-muted">
                {fieldOrder
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
          ) : (
            <>
              <p className="font-semibold">
                {status.channel === "whatsapp" ? copy.openedWhatsApp : copy.openedEmail}
              </p>
              <p className="mt-2 text-ink-muted">{copy.sendReminder(status.channel)}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={reopenHref}
                  target={status.channel === "whatsapp" ? "_blank" : undefined}
                  rel={status.channel === "whatsapp" ? "noopener noreferrer" : undefined}
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
            />
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
              >
                {budgetValues.map((value) => (
                  <option key={value} value={value}>
                    {copy.budgetOptions[value]}
                  </option>
                ))}
              </select>
            </SelectField>
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
              >
                {timelineValues.map((value) => (
                  <option key={value} value={value}>
                    {copy.timelineOptions[value]}
                  </option>
                ))}
              </select>
            </SelectField>
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
        <fieldset className="field" aria-describedby={`${id}-recipient-hint`}>
          <legend className="field-label">{copy.recipient}</legend>
          <p id={`${id}-recipient-hint`} className="field-hint">
            {copy.recipientHint}
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
            className="btn btn-primary btn-slice"
          >
            <WhatsappLogo aria-hidden className="size-5" weight="bold" />
            {copy.sendWhatsApp}
          </button>
          <button
            type="submit"
            name="channel"
            value="email"
            disabled={!hydrated}
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
