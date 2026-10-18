import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { type GlyphTone, PhaseGlyph } from "~/components/ui/status-capsule";
import { useOwnerI18n } from "~/i18n/owner";
import type { OwnerCopy } from "~/i18n/owner";
import { formatDateTime } from "~/lib/time";
import { type AdminRole } from "~/services/admin-api";
import {
  type AdminAuditAction,
  type AdminAuditEvent,
  adminAuditActions,
} from "~/services/admin-api/owner";
import { type AccountDirectory, accountLabel } from "./directory";

/** The action filter's groups, in the order an owner looks for them. */
export const auditActionGroups: {
  key: keyof OwnerCopy["audit"]["groups"];
  actions: AdminAuditAction[];
}[] = [
  {
    key: "administration",
    actions: [
      "invitation.issued",
      "invitation.revoked",
      "account.role-changed",
      "account.suspended",
      "account.reactivated",
      "credentials.reset-issued",
    ],
  },
  {
    key: "signIn",
    actions: [
      "login.succeeded",
      "login.failed",
      "mfa.challenge-failed",
      "mfa.recovery-code-used",
      "logout",
      "session.revoked",
      "session.others-revoked",
      "session.expired",
      "session.ended-inactive-account",
    ],
  },
  {
    key: "links",
    actions: [
      "owner.bootstrap-issued",
      "owner.bootstrap-refused",
      "access-link.redeemed",
      "access-link.rejected",
      "account.activated",
      "credentials.reset-completed",
      "mfa.enrollment-failed",
    ],
  },
  { key: "security", actions: ["mfa.recovery-codes-regenerated", "password.changed"] },
];

const failures: ReadonlySet<string> = new Set([
  "login.failed",
  "mfa.challenge-failed",
  "access-link.rejected",
  "mfa.enrollment-failed",
  "owner.bootstrap-refused",
]);

const administration: ReadonlySet<string> = new Set(auditActionGroups[0]!.actions);

export const isAuditAction = (value: unknown): value is AdminAuditAction =>
  typeof value === "string" && (adminAuditActions as readonly string[]).includes(value);

/** Owner actions filled, refusals and failures in danger, everything else a quiet outline. */
export function auditTone(action: string): GlyphTone {
  if (administration.has(action)) {
    return "released";
  }

  return failures.has(action) ? "stopped" : "outline";
}

export function auditActionLabel(action: string, t: OwnerCopy): string {
  return isAuditAction(action) ? t.audit.actions[action] : t.audit.unknownAction(action);
}

const roleLabel = (value: unknown, t: OwnerCopy): string | null =>
  value === "owner" || value === "admin" ? t.roles[value as AdminRole] : null;

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * The allowlisted metadata (docs/api/admin-users.md, Audit log) in words. Keys and values the
 * console does not know are left out rather than guessed; nothing here is ever a secret.
 */
export function metadataChips(event: AdminAuditEvent, t: OwnerCopy): string[] {
  const metadata = event.metadata;

  if (metadata === null) {
    return [];
  }

  const copy = t.audit.metadata;
  const chips: string[] = [];

  if (metadata.purpose === "activation" || metadata.purpose === "credential-reset") {
    chips.push(copy.purpose(t.linkPurpose[metadata.purpose]));
  }

  const to = roleLabel(metadata.to_role, t);

  if (to !== null) {
    chips.push(copy.roles(roleLabel(metadata.from_role, t), to));
  }

  if (typeof metadata.reason === "string" && metadata.reason !== "") {
    chips.push(copy.reason(t.audit.reasons[metadata.reason] ?? metadata.reason));
  }

  const sessions = count(metadata.sessions_ended);

  if (sessions !== null) {
    chips.push(copy.sessionsEnded(sessions));
  }

  const revoked = count(metadata.access_links_revoked);

  if (revoked !== null) {
    chips.push(copy.linksRevoked(revoked));
  }

  const remaining = count(metadata.recovery_codes_remaining);

  if (remaining !== null) {
    chips.push(copy.recoveryRemaining(remaining));
  }

  if (typeof metadata.account_created === "boolean") {
    chips.push(metadata.account_created ? copy.accountCreated : copy.accountExisting);
  }

  if (typeof metadata.access_link_id === "number" || typeof metadata.access_link_id === "string") {
    chips.push(copy.accessLink(metadata.access_link_id));
  }

  if (typeof metadata.email_fingerprint === "string" && metadata.email_fingerprint !== "") {
    // An HMAC of the typed address, never the address; the first characters tell attempts apart.
    chips.push(copy.fingerprint(metadata.email_fingerprint.slice(0, 12)));
  }

  return chips;
}

export function actorText(
  event: AdminAuditEvent,
  directory: AccountDirectory | null,
  currentId: number,
  t: OwnerCopy,
): string {
  if (event.actor.type === "cli") {
    return t.owner.shell;
  }

  if (event.actor.type === "user" && event.actor.user_id !== null) {
    return accountLabel(event.actor.user_id, directory, currentId, t);
  }

  return t.owner.anonymous;
}

export function subjectText(
  event: AdminAuditEvent,
  directory: AccountDirectory | null,
  currentId: number,
  t: OwnerCopy,
): string | null {
  const subject = event.subject;

  if (subject === null || subject.id === null) {
    return null;
  }

  if (subject.type === "user") {
    return accountLabel(subject.id, directory, currentId, t);
  }

  return subject.type === "access-link" ? t.owner.linkNumber(subject.id) : null;
}

/** Hours, minutes, and seconds in the reader's language and time zone. */
export function formatClock(iso: string, locale: "id" | "en"): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
}

/**
 * One audit event on the timeline: a capsule on the spine (its tone repeats what the words
 * say), what happened, who did it to whom, the metadata in words, and the technical detail
 * (event ID, action code, IP, browser) behind a disclosure.
 */
export function AuditEventItem({
  event,
  directory,
  currentId,
  showDate = false,
}: {
  event: AdminAuditEvent;
  directory: AccountDirectory | null;
  currentId: number;
  /** In a short list without day headings the time carries its date. */
  showDate?: boolean;
}) {
  const { t, locale } = useOwnerI18n();
  const copy = t.audit;
  const subject = subjectText(event, directory, currentId, t);
  const chips = metadataChips(event, t);

  return (
    <li data-row className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 pb-7 last:pb-1">
      <span className="relative z-[1] flex size-7 items-center justify-center rounded-full bg-paper">
        <PhaseGlyph status={auditTone(event.action)} className="scale-[0.8]" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3 className="text-item font-semibold text-ink">{auditActionLabel(event.action, t)}</h3>
          <time dateTime={event.occurred_at} className="text-meta text-ink-muted tabular-nums">
            {showDate
              ? (formatDateTime(event.occurred_at, locale) ?? event.occurred_at)
              : formatClock(event.occurred_at, locale)}
          </time>
        </div>
        <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-[0.9375rem]">
          <div className="flex gap-1.5">
            <dt className="text-ink-muted">{copy.by}</dt>
            <dd className="font-medium text-ink">{actorText(event, directory, currentId, t)}</dd>
          </div>
          {subject ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-muted">{copy.on}</dt>
              <dd className="font-medium text-ink">{subject}</dd>
            </div>
          ) : null}
        </dl>
        {chips.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li
                key={chip}
                className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-meta"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        <details className="mt-1.5 quiet-disclosure">
          <summary>
            <CaretRight aria-hidden size={14} weight="bold" />
            {copy.details}
          </summary>
          <dl className="mt-2 grid max-w-[44rem] gap-x-6 gap-y-1.5 rounded-[1.25rem] border border-line bg-paper-raised px-4 py-3.5 text-meta sm:grid-cols-[9.5rem_minmax(0,1fr)]">
            <dt className="text-ink-muted">{copy.eventId}</dt>
            <dd className="font-mono">{event.id}</dd>
            <dt className="text-ink-muted">{copy.actionId}</dt>
            <dd className="font-mono break-all">{event.action}</dd>
            <dt className="text-ink-muted">{copy.ip}</dt>
            <dd className="font-mono break-all">{event.ip_address ?? t.common.notRecorded}</dd>
            <dt className="text-ink-muted">{copy.userAgent}</dt>
            <dd className="break-words">{event.user_agent ?? t.common.notRecorded}</dd>
          </dl>
        </details>
      </div>
    </li>
  );
}
