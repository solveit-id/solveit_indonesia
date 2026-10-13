import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { BrandMark } from "~/components/brand/brand-mark";
import { company } from "~/data/company";
import { useI18n } from "~/i18n";
import { motionQueries } from "~/lib/motion";
import { assistantTopics, createGuideEngine, getAssistantCopy } from "~/services/assistant";
import { emailUrl, whatsappUrl } from "~/services/inquiry";
import type { AssistantInput, AssistantReply, AssistantTopic } from "~/types/assistant";

export type AssistantState = "open" | "closing" | "closed";

interface AssistantPanelProps {
  state: AssistantState;
  /** Bottom sheet that owns focus (phones) rather than a floating panel. */
  modal: boolean;
  onClose: () => void;
  onClosed: () => void;
}

type Entry =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "guide"; reply: AssistantReply; question?: string };

const MAX_QUESTION = 300;

/**
 * Solveit Assistant: an automated guide, presented as exactly that. It answers
 * from the site's own published content through a swappable engine
 * (`~/services/assistant`), sends nothing anywhere, stores nothing, and hands
 * off to WhatsApp or email when it cannot help. The conversation lives in
 * memory for this visit only.
 */
export default function AssistantPanel({ state, modal, onClose, onClosed }: AssistantPanelProps) {
  const { t, locale } = useI18n();
  const copy = getAssistantCopy(locale);
  const engine = useMemo(() => createGuideEngine(locale), [locale]);
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const greeting: Entry = {
    id: 0,
    role: "guide",
    reply: { source: "guide", text: t.assistant.greeting, followUps: assistantTopics },
  };
  const [entries, setEntries] = useState<Entry[]>([greeting]);
  const [draft, setDraft] = useState("");

  // Opening moves focus into the panel: the question field on desktop, the
  // dialog itself on phones (so the keyboard does not cover the answers).
  useEffect(() => {
    if (state !== "open") return;
    const fine = matchMedia(motionQueries.finePointer).matches;
    if (!modal && fine) inputRef.current?.focus({ preventScroll: true });
    else panelRef.current?.focus({ preventScroll: true });
  }, [state, modal]);

  // Escape closes the panel from anywhere inside it.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || state !== "open") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    panel.addEventListener("keydown", onKey);
    return () => panel.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  // New exchanges scroll inside the log only (never the page), so the
  // visitor's question sits at the top and the answer reads from its start.
  useEffect(() => {
    const log = logRef.current;
    if (!log || entries.length < 2) return;
    const items = log.querySelectorAll<HTMLElement>("[data-entry]");
    const anchor = items[items.length - 2];
    if (!anchor) return;
    const reduce = matchMedia(motionQueries.reduce).matches;
    log.scrollTo({ top: anchor.offsetTop - 12, behavior: reduce ? "auto" : "smooth" });
  }, [entries.length]);

  const ask = async (input: AssistantInput, label: string) => {
    const question = input.kind === "text" ? input.text : undefined;
    setEntries((list) => [...list, { id: nextId.current++, role: "user", text: label }]);
    const reply = await engine.reply(input);
    setEntries((list) => [...list, { id: nextId.current++, role: "guide", reply, question }]);
  };

  const pickTopic = (topic: AssistantTopic) =>
    void ask({ kind: "topic", topic }, copy.topics[topic].label);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim().slice(0, MAX_QUESTION);
    if (!text) return;
    setDraft("");
    void ask({ kind: "text", text }, text);
  };

  const restart = () => {
    setEntries([greeting]);
    setDraft("");
    inputRef.current?.focus({ preventScroll: true });
  };

  const latest = entries[entries.length - 1]?.id;

  return (
    <div className="assistant-layer" data-state={state} hidden={state === "closed"}>
      {modal && <div aria-hidden className="assistant-scrim" onClick={onClose} />}
      <section
        ref={panelRef}
        id="assistant-panel"
        role="dialog"
        aria-modal={modal}
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        tabIndex={-1}
        className="assistant-panel"
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && state === "closing") onClosed();
        }}
      >
        <header className="assistant-head">
          <span aria-hidden className="assistant-mark">
            <BrandMark className="w-[0.95rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.0625rem] leading-tight font-bold">
              {t.assistant.title}
            </h2>
            <p id={subtitleId} className="text-[0.8125rem] leading-snug text-ink-muted">
              {t.assistant.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={restart}
            className="assistant-icon-button"
            aria-label={t.assistant.restart}
            title={t.assistant.restart}
          >
            <ArrowCounterClockwise aria-hidden weight="bold" className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="assistant-icon-button"
            aria-label={t.assistant.close}
            title={t.assistant.close}
          >
            <X aria-hidden weight="bold" className="size-4" />
          </button>
        </header>

        <div
          ref={logRef}
          role="log"
          aria-label={t.assistant.log}
          aria-live="polite"
          className="assistant-log"
        >
          {entries.map((entry) =>
            entry.role === "user" ? (
              <div key={entry.id} data-entry data-role="user" className="assistant-entry">
                <p className="assistant-bubble">
                  <span className="sr-only">{t.assistant.you}: </span>
                  {entry.text}
                </p>
              </div>
            ) : (
              <GuideEntry
                key={entry.id}
                reply={entry.reply}
                question={entry.question}
                showFollowUps={entry.id === latest}
                onTopic={pickTopic}
              />
            ),
          )}
        </div>

        <footer className="assistant-foot">
          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor={`${titleId}-q`} className="sr-only">
              {t.assistant.inputLabel}
            </label>
            <input
              ref={inputRef}
              id={`${titleId}-q`}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_QUESTION}
              autoComplete="off"
              enterKeyHint="send"
              placeholder={t.assistant.placeholder}
              className="field-input min-h-11 flex-1 py-2 text-[0.9375rem]"
            />
            <button
              type="submit"
              className="assistant-send"
              aria-label={t.assistant.send}
              disabled={!draft.trim()}
            >
              <PaperPlaneRight aria-hidden weight="bold" className="size-4" />
            </button>
          </form>
          <p className="mt-2 px-1 text-[0.75rem] leading-snug text-ink-muted">
            {t.assistant.privacy}
          </p>
        </footer>
      </section>
    </div>
  );
}

function GuideEntry({
  reply,
  question,
  showFollowUps,
  onTopic,
}: {
  reply: AssistantReply;
  question?: string;
  showFollowUps: boolean;
  onTopic: (topic: AssistantTopic) => void;
}) {
  const { t, locale } = useI18n();
  const copy = getAssistantCopy(locale);
  const message = question
    ? `${t.whatsapp.greeting}\n\n${t.assistant.questionPrefix} ${question}`
    : t.whatsapp.greeting;
  const mail = emailUrl(t.common.consult, message);

  return (
    <div data-entry data-role="guide" data-source={reply.source} className="assistant-entry">
      <div className="assistant-bubble">
        <span className="sr-only">{t.assistant.guide}: </span>
        {reply.title && <p className="mb-1.5 font-semibold text-ink">{reply.title}</p>}
        <p>{reply.text}</p>
        {reply.bullets && (
          <ul className="assistant-bullets">
            {reply.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
        {reply.links && (
          <ul aria-label={t.assistant.related} className="mt-3 flex flex-wrap gap-2">
            {reply.links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="assistant-link group/link">
                  {link.label}
                  <ArrowRight
                    aria-hidden
                    weight="bold"
                    className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/link:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reply.escalate && (
        <div className="assistant-escalate">
          <p className="text-[0.875rem] font-semibold text-ink">{t.assistant.escalateTitle}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {company.whatsapp.map((number) => (
              <li key={number.e164}>
                <a
                  href={whatsappUrl(number.e164, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="assistant-link"
                >
                  <WhatsappLogo aria-hidden weight="bold" className="size-4" />
                  <span className="sr-only">{t.whatsapp.chatPrefix} </span>
                  {number.display}
                  <span className="sr-only"> {t.common.newTab}</span>
                </a>
              </li>
            ))}
            <li>
              <a href={mail} className="assistant-link">
                <EnvelopeSimple aria-hidden weight="bold" className="size-4" />
                {t.assistant.email}
              </a>
            </li>
          </ul>
          <p className="mt-2 text-[0.75rem] leading-snug text-ink-muted">
            {t.assistant.escalateNote}
          </p>
        </div>
      )}

      {showFollowUps && reply.followUps.length > 0 && (
        <div
          role="group"
          aria-label={
            reply.followUps.length === assistantTopics.length
              ? t.assistant.topicsLabel
              : t.assistant.moreTopics
          }
          className="assistant-chips"
        >
          {reply.followUps.map((topic) => (
            <button
              key={topic}
              type="button"
              className="assistant-chip"
              onClick={() => onTopic(topic)}
            >
              {copy.topics[topic].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
