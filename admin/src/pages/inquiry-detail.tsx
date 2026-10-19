import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { generalErrorCopy } from "~/auth/error-copy";
import { useVerifiedAccount } from "~/auth/use-account";
import { Fact, Facts } from "~/components/account/facts";
import {
  PageHeader,
  hasPermission,
  isForbidden,
  refreshAccount,
  useFocusWhen,
} from "~/components/admin/owner-ui";
import {
  type SensitiveAction,
  SensitiveActionDialog,
} from "~/components/admin/sensitive-action-dialog";
import { ContactFact } from "~/components/inquiry/contact-reveal";
import { InquiryNotes } from "~/components/inquiry/inquiry-notes";
import {
  InquiryForbidden,
  InquiryStatusCapsule,
  PrivacyFoot,
  statusLabel,
} from "~/components/inquiry/inquiry-ui";
import { StatusHistory } from "~/components/inquiry/status-history";
import { Button } from "~/components/ui/button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { Panel } from "~/components/ui/panel";
import { ErrorState, LoadingState } from "~/components/ui/state-view";
import { type InquiryCopy, useInquiryI18n } from "~/i18n/inquiry";
import { useMotion } from "~/lib/motion";
import { formatDateTime } from "~/lib/time";
import { paths } from "~/routes/paths";
import { isAdminApiError } from "~/services/admin-api";
import {
  type AdminInquiryDetail,
  type InquiryStatus,
  inquiryApi,
} from "~/services/admin-api/inquiry";

interface Message {
  tone: NoticeTone;
  text: string;
}

type Loaded =
  | { kind: "loading" }
  | { kind: "failed"; error: unknown }
  | { kind: "ready"; inquiry: AdminInquiryDetail };

/**
 * The button for a move: reopening a closed inquiry reads as what it is. Nothing moves back to
 * `received` (Laravel's rule), so it has no button of its own; shown as written if ever sent.
 */
function moveLabel(from: InquiryStatus, to: InquiryStatus, t: InquiryCopy): string {
  if (from === "closed" && to === "in-review") {
    return t.detail.reopen;
  }

  return to === "received" ? statusLabel(to, t) : (t.detail.move[to] ?? to);
}

/**
 * One inquiry (B4b, `GET inquiries/{id}`): what the visitor sent (contact masked, the message
 * as plain text), the status with the moves Laravel allows from it, the status history, and
 * the internal notes. Laravel authorizes each request by its `inquiries.*` permission; the
 * screen hides what the account may not do and explains a 403.
 *
 * A status change is a compare and set: the request carries the status this screen showed
 * (`expected_status`). When someone else moved it first, Laravel answers 409 and the dialog
 * says so, the inquiry is read again, and the person decides again on the current state.
 * Nothing is resent by itself; an uncertain answer is resolved by a read.
 */
export function InquiryDetail() {
  const { t } = useInquiryI18n();
  const account = useVerifiedAccount();
  const { id } = useParams();
  const inquiryId = /^[1-9][0-9]{0,9}$/.test(id ?? "") ? Number(id) : null;

  if (!hasPermission(account, "inquiries.view")) {
    return (
      <article>
        <PageHeader back={{ to: paths.inquiries, label: t.detail.back }} title={t.list.title} />
        <div className="mt-10">
          <InquiryForbidden />
        </div>
      </article>
    );
  }

  if (inquiryId === null) {
    return <NotFoundInquiry />;
  }

  // A different ID is a different screen: nothing of the previous inquiry survives, least of
  // all a revealed contact.
  return <InquiryView key={inquiryId} id={inquiryId} />;
}

function NotFoundInquiry() {
  const { t } = useInquiryI18n();

  return (
    <article>
      <PageHeader
        back={{ to: paths.inquiries, label: t.detail.back }}
        title={t.detail.notFoundTitle}
      />
      <p className="mt-4 max-w-[64ch] text-[1.0625rem] text-ink-muted">{t.detail.notFoundBody}</p>
    </article>
  );
}

function InquiryView({ id }: { id: number }) {
  const { t } = useInquiryI18n();
  const account = useVerifiedAccount();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [message, setMessage] = useState<Message | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [target, setTarget] = useState<InquiryStatus | null>(null);
  // Bumped after each change Laravel confirmed: replays the highlight, reloads the history.
  const [changes, setChanges] = useState(0);
  const statusPanel = useRef<HTMLDivElement>(null);
  const messageNotice = useRef<HTMLDivElement>(null);
  const uncertainNotice = useRef<HTMLDivElement>(null);
  useFocusWhen(messageNotice, message);
  useFocusWhen(uncertainNotice, uncertain);

  useEffect(() => {
    const controller = new AbortController();

    inquiryApi.getInquiry(id, controller.signal).then(
      (inquiry) => setLoaded({ kind: "ready", inquiry }),
      (error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(isAdminApiError(error) && error.kind === "unauthenticated")
        ) {
          setLoaded({ kind: "failed", error });
        }
      },
    );

    return () => controller.abort();
  }, [id]);

  /**
   * Every answer that replaces the inquiry on screen (a read or a confirmed write) takes the
   * next ticket; an answer whose ticket is no longer the latest arrived out of order and is
   * dropped, so an older read can never paint over a newer state. Writes stay safe without it
   * (compare and set); this keeps the screen honest.
   */
  const latest = useRef(0);

  /** A read of the current state: after a refusal, an uncertain write, or on request. */
  const read = useCallback(async (): Promise<AdminInquiryDetail | null> => {
    const ticket = ++latest.current;

    try {
      const inquiry = await inquiryApi.getInquiry(id);

      if (ticket !== latest.current) {
        return null;
      }

      setLoaded({ kind: "ready", inquiry });

      return inquiry;
    } catch (error) {
      if (
        ticket === latest.current &&
        !(isAdminApiError(error) && error.kind === "unauthenticated")
      ) {
        setLoaded({ kind: "failed", error });
      }

      return null;
    }
  }, [id]);

  // The status that changed settles in, so the person sees what moved.
  useMotion(
    ({ gsap }) => {
      if (changes > 0) {
        gsap.from("[data-fact-value]", { x: -6, opacity: 0.35, duration: 0.42, stagger: 0.03 });
      }
    },
    { scope: statusPanel, dependencies: [changes] },
  );

  const back = { to: paths.inquiries, label: t.detail.back };

  if (loaded.kind === "loading") {
    return (
      <article>
        <PageHeader back={back} title={t.detail.loading} />
        <div className="mt-10">
          <LoadingState label={t.detail.loading} rows={4} />
        </div>
      </article>
    );
  }

  if (loaded.kind === "failed") {
    if (isAdminApiError(loaded.error) && loaded.error.kind === "not-found") {
      return <NotFoundInquiry />;
    }

    if (isForbidden(loaded.error)) {
      return (
        <article>
          <PageHeader back={back} title={t.list.title} />
          <div className="mt-10">
            <InquiryForbidden />
          </div>
        </article>
      );
    }

    return (
      <article>
        <PageHeader back={back} title={t.detail.loadFailed} />
        <div className="mt-10">
          <ErrorState
            title={t.detail.loadFailed}
            retryLabel={t.common.retry}
            onRetry={() => void read()}
          >
            {generalErrorCopy(loaded.error, t)}
          </ErrorState>
        </div>
      </article>
    );
  }

  const inquiry = loaded.inquiry;
  const canChange = hasPermission(account, "inquiries.change-status");

  const statusAction: SensitiveAction<AdminInquiryDetail> | null =
    target === null
      ? null
      : {
          title: t.detail.confirmTitle(statusLabel(target, t)),
          description: t.detail.confirmBody(statusLabel(inquiry.status, t), statusLabel(target, t)),
          confirmLabel: moveLabel(inquiry.status, target, t),
          busyLabel: t.detail.changing,
          // Compare and set against the status on this screen when the person decided.
          run: () =>
            inquiryApi.changeStatus(id, { status: target, expectedStatus: inquiry.status }),
          onDone: (next) => {
            const label = statusLabel(next.status, t);

            latest.current += 1;
            setLoaded({ kind: "ready", inquiry: next });
            setTarget(null);
            setUncertain(false);
            // 200 without a new history row: it already had that status (admin-inquiries.md).
            setMessage({
              tone: "success",
              text:
                next.status_changes_count === inquiry.status_changes_count
                  ? t.detail.changedSame(label)
                  : t.detail.changed(label),
            });
            setChanges((value) => value + 1);
          },
          onUncertain: () => {
            setTarget(null);
            setMessage(null);
            setUncertain(true);
          },
          // 409 (changed meanwhile, or not allowed now) and 404: read what is there now.
          onStale: () => {
            void read().then((now) => {
              if (now !== null) {
                setMessage({ tone: "info", text: t.detail.reloaded(statusLabel(now.status, t)) });
                setChanges((value) => value + 1);
              }
            });
          },
          onForbidden: () => void refreshAccount(),
        };

  /** Resolve an uncertain change by reading the inquiry; never by sending it again. */
  const check = async () => {
    setChecking(true);
    const now = await read();
    setChecking(false);

    if (now === null) {
      return;
    }

    setUncertain(false);
    setMessage({ tone: "info", text: t.detail.checked(statusLabel(now.status, t)) });
    setChanges((value) => value + 1);
  };

  const closeDialog = () => {
    setTarget(null);

    // The pressed move may be gone (the status changed): continue at the notice, if any.
    window.requestAnimationFrame(() => messageNotice.current?.focus());
  };

  return (
    <article>
      <PageHeader
        back={back}
        title={inquiry.name}
        lede={
          <div className="grid gap-3">
            <p className="font-mono text-[0.9375rem] [overflow-wrap:anywhere]">
              {inquiry.reference}
            </p>
            <div className="flex flex-wrap gap-2">
              <InquiryStatusCapsule status={inquiry.status} />
              <span className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-meta font-medium text-ink">
                {t.service[inquiry.service] ?? inquiry.service}
              </span>
            </div>
          </div>
        }
      />

      {message || uncertain ? (
        <div className="mt-8 grid max-w-[76rem] gap-4">
          {message ? (
            <Notice ref={messageNotice} tone={message.tone}>
              {message.text}
            </Notice>
          ) : null}
          {uncertain ? (
            <Notice
              ref={uncertainNotice}
              tone="warning"
              action={
                <Button
                  busy={checking}
                  busyLabel={t.detail.checking}
                  icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
                  onClick={() => void check()}
                >
                  {t.detail.checkState}
                </Button>
              }
            >
              {t.detail.uncertain}
            </Notice>
          ) : null}
        </div>
      ) : null}

      <div className="mt-10 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-x-12">
        {/* Status comes first in the document: below 1280 px it is the first thing after the
            header (no scrolling past a long message), and visual, focus, and reading order
            agree; from 1280 px the grid places it in the sticky side column. */}
        <section
          ref={statusPanel}
          aria-labelledby="status-title"
          className="rounded-panel border border-line bg-paper-raised p-6 sm:p-7 xl:sticky xl:top-10 xl:col-start-2 xl:row-span-3 xl:row-start-1"
        >
          <h2 id="status-title" className="text-section font-wide">
            {t.detail.statusTitle}
          </h2>
          <div className="mt-4">
            <span data-fact-value className="inline-block">
              <InquiryStatusCapsule status={inquiry.status} />
            </span>
            <p className="mt-2 text-[0.9375rem] text-ink-muted">
              {t.statusDetail[inquiry.status] ?? ""}
            </p>
            <p className="mt-2 text-meta text-ink-muted">{t.detail.statusNote}</p>
          </div>
          <div className="mt-5 border-t border-line pt-5">
            {!canChange ? (
              <p className="text-[0.9375rem] text-ink-muted">{t.detail.cannotChange}</p>
            ) : inquiry.allowed_transitions.length === 0 ? (
              <p className="text-[0.9375rem] text-ink-muted">{t.detail.noMoves}</p>
            ) : (
              <>
                <div className="grid justify-items-start gap-3">
                  {inquiry.allowed_transitions.map((to) => (
                    <Button
                      key={to}
                      variant="secondary"
                      onClick={() => {
                        setMessage(null);
                        setTarget(to);
                      }}
                    >
                      {moveLabel(inquiry.status, to, t)}
                    </Button>
                  ))}
                </div>
                <p className="mt-4 text-meta text-ink-muted">{t.detail.movesNote}</p>
              </>
            )}
          </div>
          {hasPermission(account, "audit.view-all") ? (
            <Link
              to={`${paths.audit}?inquiry=${inquiry.id}`}
              className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              {t.detail.auditLink}
              <ArrowRight aria-hidden size={16} weight="bold" />
            </Link>
          ) : null}
        </section>

        <div className="grid min-w-0 gap-6 xl:col-start-1 xl:row-start-1">
          <SubmissionPanel inquiry={inquiry} onGone={() => void read()} />
        </div>

        <div className="min-w-0 xl:col-start-1">
          <StatusHistory inquiryId={id} version={changes} currentId={account.id} />
        </div>
        <div className="min-w-0 xl:col-start-1">
          <InquiryNotes
            inquiryId={id}
            currentId={account.id}
            canAdd={hasPermission(account, "inquiries.add-note")}
            onGone={() => void read()}
          />
        </div>
      </div>

      <PrivacyFoot />

      <SensitiveActionDialog open={target !== null} action={statusAction} onClose={closeDialog} />
    </article>
  );
}

function SubmissionPanel({ inquiry, onGone }: { inquiry: AdminInquiryDetail; onGone: () => void }) {
  const { t, locale } = useInquiryI18n();
  const account = useVerifiedAccount();
  const copy = t.detail;
  const when = (iso: string | null) => formatDateTime(iso, locale) ?? t.common.notRecorded;

  return (
    <Panel title={copy.submissionTitle}>
      <p className="text-meta text-ink-muted">{copy.submissionNote}</p>
      <div className="mt-3">
        <Facts>
          <Fact term={copy.name}>
            <span className="[overflow-wrap:anywhere]">{inquiry.name}</span>
          </Fact>
          <Fact term={copy.organization}>
            {inquiry.organization ? (
              <span className="[overflow-wrap:anywhere]">{inquiry.organization}</span>
            ) : (
              <span className="text-ink-muted">{copy.noOrganization}</span>
            )}
          </Fact>
          <Fact term={copy.contact}>
            <ContactFact
              inquiry={inquiry}
              canReveal={hasPermission(account, "inquiries.reveal-contact")}
              onGone={onGone}
            />
          </Fact>
          <Fact term={copy.service}>{t.service[inquiry.service] ?? inquiry.service}</Fact>
          <Fact term={copy.budget}>{t.budget[inquiry.budget] ?? inquiry.budget}</Fact>
          <Fact term={copy.timeline}>{t.timeline[inquiry.timeline] ?? inquiry.timeline}</Fact>
          <Fact term={copy.reference}>
            <span className="font-mono [overflow-wrap:anywhere]">{inquiry.reference}</span>
          </Fact>
          <Fact term={copy.received}>{when(inquiry.received_at)}</Fact>
          <Fact term={copy.updated}>{when(inquiry.updated_at)}</Fact>
        </Facts>
      </div>
      <section aria-labelledby="message-title" className="mt-6 border-t border-line pt-5">
        <h3 id="message-title" className="text-item font-semibold">
          {copy.messageTitle}
        </h3>
        <p className="mt-1 text-meta text-ink-muted">{copy.messageNote}</p>
        {/* Plain text as sent: React escapes it, line breaks are kept, nothing is linked. */}
        <p className="mt-3 max-w-[68ch] rounded-[1.25rem] border border-line bg-paper px-5 py-4 [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
          {inquiry.message}
        </p>
      </section>
    </Panel>
  );
}
