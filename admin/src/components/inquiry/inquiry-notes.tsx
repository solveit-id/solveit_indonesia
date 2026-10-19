import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { NotePencil } from "@phosphor-icons/react/dist/csr/NotePencil";
import { type FormEvent, useRef, useState } from "react";
import { generalErrorCopy, isUncertain } from "~/auth/error-copy";
import {
  ListFooter,
  refreshAccount,
  useFocusAppended,
  useFocusWhen,
  useRowEntrance,
} from "~/components/admin/owner-ui";
import { useCursorList } from "~/components/admin/use-cursor-list";
import { Button } from "~/components/ui/button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { TextAreaField } from "~/components/ui/text-area-field";
import { useInquiryI18n } from "~/i18n/inquiry";
import { formatDateTime, retryAt, useSecondsUntil } from "~/lib/time";
import { isAdminApiError } from "~/services/admin-api";
import { NOTE_MAX_LENGTH, type PageRequest, inquiryApi } from "~/services/admin-api/inquiry";
import { actorLabel, inquiryListErrorCopy } from "./inquiry-ui";

interface NotesKey {
  id: number;
  version: number;
}

const listNotes = (key: NotesKey, page: PageRequest) => inquiryApi.listNotes(key.id, page);

/** Characters as Laravel counts them (code points), not UTF-16 units. */
const length = (text: string) => [...text].length;

interface Message {
  tone: NoticeTone;
  text: string;
}

/**
 * A note whose outcome is not known. `after` is the newest note ID this screen knew before the
 * attempt (null when the notes had not loaded): IDs grow with every insert, so only a note
 * newer than it can be the attempt.
 */
interface PendingNote {
  body: string;
  after: number | null;
  /** `unknown` before any check; `not-seen` or `ambiguous` after a check proved nothing. */
  checked: "unknown" | "not-seen" | "ambiguous";
}

/**
 * Internal notes of one inquiry (`GET`/`POST inquiries/{id}/notes`): the form to add one and
 * the notes newest first. Notes are append-only; nothing here edits or deletes one.
 *
 * Adding is one deliberate press and is never resent by itself. Laravel has no idempotency key
 * for notes, so an uncertain answer (5xx, network, timeout, unreadable success) holds the
 * attempt: the text stays, read only, and sending is held. "Check the notes" reads the newest
 * notes; the attempt counts as saved only when a note by this account with exactly this text
 * and an ID newer than the attempt's start is there. Anything else proves nothing (the server
 * may still be finishing, or an older identical note exists), so the outcome stays unknown and
 * the person decides: check again, send again on purpose (a duplicate cannot be deleted), or
 * drop the text. 419 (not processed, press again), 429 (a countdown, nothing sent), 403
 * (re-read the account), and 404 (the inquiry is gone) are said in words. The draft lives in
 * this component's memory only: never storage.
 */
export function InquiryNotes({
  inquiryId,
  currentId,
  canAdd,
  onGone,
}: {
  inquiryId: number;
  currentId: number;
  canAdd: boolean;
  /** 404 on add: the inquiry no longer exists; the detail reads it again. */
  onGone: () => void;
}) {
  const { t, locale } = useInquiryI18n();
  const copy = t.notes;
  const [version, setVersion] = useState(0);
  const { state, loadMore, moreBusy, moreError, reload } = useCursorList(listNotes, {
    id: inquiryId,
    version,
  });
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<PendingNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const wait = useSecondsUntil(blockedUntil);
  const inFlight = useRef(false);
  const rows = useRef<HTMLOListElement>(null);
  const pendingNotice = useRef<HTMLDivElement>(null);
  useFocusWhen(pendingNotice, pending);

  const ready = state.status === "ready" ? state : null;
  useRowEntrance(rows, ready?.revision ?? null, ready?.appendedFrom ?? 0);
  useFocusAppended(rows, ready?.appendedFrom ?? null);

  const left = NOTE_MAX_LENGTH - length(draft.trim());

  /** One attempt, sent once. `after` marks where its note would appear (see PendingNote). */
  const send = async (body: string, after: number | null) => {
    inFlight.current = true;
    setBusy(true);
    setFieldError(undefined);
    setMessage(null);

    try {
      await inquiryApi.addNote(inquiryId, body);
      setPending(null);
      setDraft("");
      setMessage({ tone: "success", text: copy.added });
      setVersion((value) => value + 1);
    } catch (error) {
      if (isAdminApiError(error)) {
        switch (error.kind) {
          case "unauthenticated":
            // The session store sends the person to sign-in.
            return;
          case "csrf":
            setMessage({ tone: "warning", text: copy.resend });

            return;
          case "rate-limited":
            setBlockedUntil(retryAt(error.retryAfterSeconds));

            return;
          case "validation":
            setFieldError(copy.serverInvalid);

            return;
          case "forbidden":
            setMessage({ tone: "danger", text: copy.forbidden });
            void refreshAccount();

            return;
          case "not-found":
            setMessage({ tone: "danger", text: copy.gone });
            onGone();

            return;
          default:
            break;
        }
      }

      if (isUncertain(error)) {
        setPending({ body, after, checked: "unknown" });
      } else {
        setMessage({ tone: "danger", text: generalErrorCopy(error, t) });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (inFlight.current || wait > 0) {
      return;
    }

    if (pending !== null) {
      // Held until the person decides what the unknown outcome means.
      pendingNotice.current?.focus();

      return;
    }

    const body = draft.trim();

    if (body === "") {
      setFieldError(copy.missing);

      return;
    }

    if (length(body) > NOTE_MAX_LENGTH) {
      setFieldError(copy.tooLong);

      return;
    }

    // The newest note known now; null when the notes have not loaded (then nothing proves).
    const after = ready ? Math.max(0, ...ready.items.map((note) => note.id)) : null;
    void send(body, after);
  };

  /** Look for the held note among the newest ones; never send it again by itself. */
  const check = async () => {
    if (pending === null) {
      return;
    }

    setChecking(true);

    try {
      const page = await inquiryApi.listNotes(inquiryId);
      const same = page.data.filter(
        (note) => note.author.user_id === currentId && note.body === pending.body,
      );
      const saved =
        pending.after === null ? undefined : same.find((note) => note.id > pending.after!);

      setVersion((value) => value + 1);

      if (saved) {
        setPending(null);
        setDraft("");
        setMessage({ tone: "success", text: copy.checkFound(saved.id) });

        return;
      }

      setMessage(null);
      setPending({
        ...pending,
        // A deliberate resend looks for its note after the newest note seen now.
        after: Math.max(pending.after ?? 0, 0, ...page.data.map((note) => note.id)),
        checked: same.length > 0 && pending.after === null ? "ambiguous" : "not-seen",
      });
    } catch (error) {
      if (!(isAdminApiError(error) && error.kind === "unauthenticated")) {
        setMessage({ tone: "danger", text: generalErrorCopy(error, t) });
      }
    } finally {
      setChecking(false);
    }
  };

  const discard = () => {
    setPending(null);
    setDraft("");
    setMessage({ tone: "info", text: copy.discarded });
  };

  return (
    <section
      aria-labelledby="notes-title"
      className="rounded-panel border border-line bg-paper-raised p-6 sm:p-7"
    >
      <h2 id="notes-title" className="text-section font-wide">
        {copy.title}
      </h2>
      <p className="mt-2 max-w-[64ch] text-[0.9375rem] text-ink-muted">{copy.body}</p>

      {canAdd ? (
        <form noValidate onSubmit={submit} className="mt-5 grid gap-4">
          <TextAreaField
            label={copy.field}
            rows={4}
            value={draft}
            readOnly={pending !== null}
            hint={pending !== null ? copy.heldHint : copy.hint(Math.max(0, left))}
            error={fieldError ?? (left < 0 ? copy.tooLong : undefined)}
            onChange={(event) => {
              setDraft(event.target.value);
              setFieldError(undefined);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              busy={busy}
              busyLabel={copy.adding}
              aria-disabled={wait > 0 || pending !== null || undefined}
              icon={<NotePencil aria-hidden size={18} weight="bold" />}
            >
              {copy.add}
            </Button>
          </div>
          {wait > 0 ? <Notice tone="warning">{t.errors.rateLimited(wait)}</Notice> : null}
          {pending !== null ? (
            <Notice
              ref={pendingNotice}
              tone="warning"
              action={
                <>
                  <Button
                    busy={checking}
                    busyLabel={copy.checking}
                    icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
                    onClick={() => void check()}
                  >
                    {pending.checked === "unknown" ? copy.check : copy.checkAgain}
                  </Button>
                  {pending.checked === "unknown" ? null : (
                    <>
                      <Button
                        busy={busy}
                        busyLabel={copy.adding}
                        aria-disabled={wait > 0 || checking || undefined}
                        onClick={() => {
                          if (!inFlight.current && wait === 0 && !checking) {
                            void send(pending.body, pending.after);
                          }
                        }}
                      >
                        {copy.sendAgain}
                      </Button>
                      <Button variant="quiet" onClick={discard}>
                        {copy.discard}
                      </Button>
                    </>
                  )}
                </>
              }
            >
              {pending.checked === "unknown"
                ? copy.uncertain
                : pending.checked === "ambiguous"
                  ? copy.ambiguous
                  : copy.notSeen}
            </Notice>
          ) : null}
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        </form>
      ) : (
        <p className="mt-5 text-[0.9375rem] text-ink-muted">{copy.cannotAdd}</p>
      )}

      <div className="mt-7 border-t border-line pt-6">
        {state.status === "loading" ? <LoadingState label={copy.loading} rows={3} /> : null}
        {state.status === "failed" ? (
          <ErrorState title={copy.loadFailed} retryLabel={t.common.retry} onRetry={reload}>
            {inquiryListErrorCopy(state.error, t)}
          </ErrorState>
        ) : null}
        {ready && ready.items.length === 0 ? (
          <EmptyState title={copy.empty}>{copy.emptyBody}</EmptyState>
        ) : null}
        {ready && ready.items.length > 0 ? (
          <>
            <ol ref={rows} aria-label={copy.title} className="grid gap-4">
              {ready.items.map((note) => (
                <li
                  key={note.id}
                  data-row
                  className="rounded-[1.25rem] border border-line bg-paper px-5 py-4"
                >
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-meta">
                    <span>
                      <span className="text-ink-muted">{copy.by}</span>{" "}
                      <span className="font-semibold text-ink">
                        {actorLabel(note.author, currentId, t)}
                      </span>
                    </span>
                    {note.created_at ? (
                      <time dateTime={note.created_at} className="text-ink-muted tabular-nums">
                        {formatDateTime(note.created_at, locale) ?? note.created_at}
                      </time>
                    ) : null}
                  </p>
                  <p className="mt-2 max-w-[68ch] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                    {note.body}
                  </p>
                </li>
              ))}
            </ol>
            <ListFooter
              summary={copy.showing(ready.items.length, ready.hasMore)}
              hasMore={ready.hasMore && !ready.refreshing}
              busy={moreBusy}
              error={moreError}
              loadLabel={copy.loadMore}
              onLoadMore={() => void loadMore()}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
