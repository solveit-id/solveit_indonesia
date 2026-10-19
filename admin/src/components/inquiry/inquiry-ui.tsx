import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { Link } from "react-router";
import { generalErrorCopy } from "~/auth/error-copy";
import { type GlyphTone, StatusCapsule } from "~/components/ui/status-capsule";
import { type InquiryCopy, useInquiryI18n } from "~/i18n/inquiry";
import { paths } from "~/routes/paths";
import { isAdminApiError } from "~/services/admin-api";
import type { InquiryActor, InquiryStatus } from "~/services/admin-api/inquiry";

/**
 * Workflow statuses as capsule tones, always with the word: new (dashed, nobody has it yet),
 * in review (half), contacted (filled), closed (hollow, ended but can reopen).
 */
export const inquiryTone: Record<InquiryStatus, GlyphTone> = {
  received: "planned",
  "in-review": "current",
  contacted: "released",
  closed: "ended",
};

/** A status Laravel sends that this console does not know yet is shown as written. */
export const statusLabel = (status: string, t: InquiryCopy): string =>
  Object.hasOwn(t.status, status) ? t.status[status as InquiryStatus] : status;

export function InquiryStatusCapsule({ status }: { status: InquiryStatus }) {
  const { t } = useInquiryI18n();

  return <StatusCapsule status={inquiryTone[status] ?? "outline"} label={statusLabel(status, t)} />;
}

/** Why an inquiry list could not load, in the words a person can act on. */
export function inquiryListErrorCopy(error: unknown, t: InquiryCopy): string {
  if (isAdminApiError(error)) {
    if (error.kind === "validation") {
      return t.inquiry.filterRefused;
    }

    if (error.kind === "rate-limited") {
      return t.errors.rateLimited(error.retryAfterSeconds ?? 60);
    }
  }

  return generalErrorCopy(error, t);
}

/** Who wrote a history row or a note: "You", the display name, or "Account #7". */
export function actorLabel(actor: InquiryActor, currentId: number, t: InquiryCopy): string {
  if (actor.user_id !== null && actor.user_id === currentId) {
    return t.inquiry.you;
  }

  if (actor.name !== null && actor.name.trim() !== "") {
    return actor.name;
  }

  return actor.user_id === null ? t.inquiry.unknownAccount : t.inquiry.accountNumber(actor.user_id);
}

/**
 * An inquiry screen opened by an account without `inquiries.view` (or refused by Laravel with
 * 403): says so and shows no data. Laravel stays the authority; this only explains its answer.
 */
export function InquiryForbidden() {
  const { t } = useInquiryI18n();

  return (
    <div className="max-w-[44rem] rounded-panel border border-line bg-paper-raised p-6 sm:p-8">
      <LockKey aria-hidden size={28} weight="bold" className="text-accent-text" />
      <h2 className="mt-4 text-section font-wide">{t.inquiry.forbiddenTitle}</h2>
      <p className="mt-2 text-ink-muted">{t.inquiry.forbiddenBody}</p>
      <Link to={paths.home} className="mt-6 btn btn-secondary">
        {t.inquiry.toHome}
      </Link>
    </div>
  );
}

/** The privacy note at the foot of the inquiry screens: what is not decided, said plainly. */
export function PrivacyFoot() {
  const { t } = useInquiryI18n();

  return (
    <p className="mt-12 max-w-[64ch] border-t border-line pt-5 text-meta text-ink-muted">
      {t.inquiry.privacy}
    </p>
  );
}
