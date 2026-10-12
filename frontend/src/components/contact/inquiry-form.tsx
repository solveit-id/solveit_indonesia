import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useHydrated } from "~/hooks/use-hydrated";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { isServiceId, services } from "~/data/services";
import { cn } from "~/lib/cn";
import {
  budgetOptions,
  composeInquiryMessage,
  emptyInquiry,
  type InquiryChannel,
  inquiryHref,
  timelineOptions,
  validateInquiry,
} from "~/services/inquiry";
import type { InquiryErrors, InquiryPayload } from "~/types/inquiry";

type Status =
  | { kind: "idle" }
  | { kind: "invalid"; count: number }
  | { kind: "opened"; channel: InquiryChannel; href: string; message: string };

const fieldOrder: (keyof InquiryPayload)[] = ["name", "contact", "service", "message"];

export function InquiryForm() {
  const id = `inq${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [params] = useSearchParams();
  const [values, setValues] = useState<InquiryPayload>(emptyInquiry);
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Prefill the service chosen in the hero or on the services page. Only after
  // hydration, so the prerendered markup (no query string) and the client match.
  const hydrated = useHydrated();
  const preset = params.get("layanan");
  const payload: InquiryPayload = {
    ...values,
    service: values.service || (hydrated && isServiceId(preset) ? preset : ""),
  };

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
    const nextErrors = validateInquiry(payload);
    setErrors(nextErrors);
    const invalid = fieldOrder.filter((key) => nextErrors[key]);
    if (invalid.length > 0) {
      setStatus({ kind: "invalid", count: invalid.length });
      return;
    }
    const href = inquiryHref(channel, payload);
    if (channel === "whatsapp") window.open(href, "_blank", "noopener,noreferrer");
    else window.location.href = href;
    setCopied(false);
    setStatus({ kind: "opened", channel, href, message: composeInquiryMessage(payload) });
  };

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

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="grid gap-8"
      aria-describedby={`${id}-intro`}
    >
      <p id={`${id}-intro`} className="text-ink-muted">
        Kolom bertanda bintang (*) wajib diisi. Formulir ini tidak mengirim atau menyimpan data:
        pesan disusun di perangkat Anda, lalu Anda kirim sendiri.
      </p>

      {status.kind !== "idle" && (
        <div
          ref={statusRef}
          tabIndex={-1}
          role={status.kind === "invalid" ? "alert" : "status"}
          className={cn(
            "rounded-[var(--radius-field)] border p-6 outline-none",
            status.kind === "invalid"
              ? "border-[#b42318] bg-[#b42318]/5"
              : "border-accent bg-accent/5",
          )}
        >
          {status.kind === "invalid" ? (
            <>
              <p className="font-semibold">Ada {status.count} kolom yang perlu dilengkapi.</p>
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
                {status.channel === "whatsapp"
                  ? "WhatsApp dibuka dengan pesan yang sudah tersusun."
                  : "Aplikasi email dibuka dengan pesan yang sudah tersusun."}
              </p>
              <p className="mt-2 text-ink-muted">
                Pesan baru terkirim setelah Anda menekan tombol kirim di{" "}
                {status.channel === "whatsapp" ? "WhatsApp" : "aplikasi email"}. Tidak terbuka?
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={status.href}
                  target={status.channel === "whatsapp" ? "_blank" : undefined}
                  rel={status.channel === "whatsapp" ? "noopener noreferrer" : undefined}
                  className="btn btn-secondary min-h-11"
                >
                  Buka lagi
                </a>
                <button type="button" onClick={copyMessage} className="btn btn-secondary min-h-11">
                  {copied ? "Pesan tersalin" : "Salin pesan"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={`${id}-name`} className="field-label">
            Nama <span aria-hidden>*</span>
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
        <div className="grid gap-2">
          <label htmlFor={`${id}-organization`} className="field-label">
            Bisnis atau organisasi
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

      <div className="grid gap-2">
        <label htmlFor={`${id}-contact`} className="field-label">
          Email atau nomor WhatsApp <span aria-hidden>*</span>
        </label>
        <p id={`${id}-contact-hint`} className="field-hint">
          Kami membalas lewat kontak ini.
        </p>
        <input
          id={`${id}-contact`}
          name="contact"
          inputMode="email"
          autoComplete="email"
          className="field-input"
          value={values.contact}
          onChange={(event) => update("contact", event.target.value)}
          aria-invalid={Boolean(errors.contact)}
          aria-describedby={describe("contact", true)}
          required
        />
        {error("contact")}
      </div>

      <fieldset className="grid gap-3" aria-describedby={describe("service")}>
        <legend id={`${id}-service`} tabIndex={-1} className="field-label outline-none">
          Layanan yang dibutuhkan <span aria-hidden>*</span>
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

      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={`${id}-budget`} className="field-label">
            Perkiraan anggaran
          </label>
          <select
            id={`${id}-budget`}
            name="budget"
            className="field-input appearance-none bg-[length:1rem] bg-[right_1.25rem_center] bg-no-repeat pr-12"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath fill='%235c7392' d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E\")",
            }}
            value={values.budget}
            onChange={(event) => update("budget", event.target.value as InquiryPayload["budget"])}
          >
            {budgetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="grid gap-3">
          <legend className="field-label">Target waktu</legend>
          <div className="flex flex-wrap gap-2">
            {timelineOptions.map((option) => (
              <label key={option.value} className="choice">
                <input
                  type="radio"
                  name="timeline"
                  value={option.value}
                  checked={values.timeline === option.value}
                  onChange={() => update("timeline", option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-2">
        <label htmlFor={`${id}-message`} className="field-label">
          Ceritakan kebutuhan Anda <span aria-hidden>*</span>
        </label>
        <p id={`${id}-message-hint`} className="field-hint">
          Misalnya proses yang ingin dirapikan, siapa penggunanya, dan sistem yang sudah dipakai.
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

      <div className="flex flex-wrap gap-3 border-t border-line pt-8">
        <button type="submit" name="channel" value="whatsapp" className="btn btn-primary">
          <WhatsappLogo aria-hidden className="size-5" weight="bold" />
          Kirim lewat WhatsApp
        </button>
        <button type="submit" name="channel" value="email" className="btn btn-secondary">
          <EnvelopeSimple aria-hidden className="size-5" weight="bold" />
          Kirim lewat email
        </button>
      </div>
    </form>
  );
}
