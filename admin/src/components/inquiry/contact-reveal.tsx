import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { useRef, useState } from "react";
import { refreshAccount, useFocusWhen } from "~/components/admin/owner-ui";
import {
  type SensitiveAction,
  SensitiveActionDialog,
} from "~/components/admin/sensitive-action-dialog";
import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { useInquiryI18n } from "~/i18n/inquiry";
import { formatTime } from "~/lib/time";
import { AdminApiError } from "~/services/admin-api";
import {
  type AdminInquiryDetail,
  type AdminRevealedContact,
  inquiryApi,
} from "~/services/admin-api/inquiry";

interface Message {
  tone: NoticeTone;
  text: string;
}

/**
 * The contact of one inquiry: masked as Laravel sends it, and the deliberate way to open it in
 * full (`POST inquiries/{id}/contact-reveal`, admin-inquiries.md, Kontak lengkap).
 *
 * - Opening is a press in SensitiveActionDialog after ticking the acknowledgement; on 423 the
 *   dialog confirms the password and asks once more. Nothing is sent by itself, ever.
 * - The full value lives in this component's state only: never in storage, the address, the
 *   router state, a title, an attribute, a notice, or a log. Hide drops it; leaving the screen
 *   unmounts it. Opening it again is a new, recorded opening.
 * - Notices about it never carry the value; an uncertain answer says that the opening may have
 *   been recorded and offers nothing automatic.
 */
export function ContactFact({
  inquiry,
  canReveal,
  onGone,
}: {
  inquiry: AdminInquiryDetail;
  canReveal: boolean;
  /** 404 or 409: the inquiry changed under us; the detail reads it again. */
  onGone: () => void;
}) {
  const { t, locale } = useInquiryI18n();
  const copy = t.contact;
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [revealed, setRevealed] = useState<AdminRevealedContact | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const shown = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  // Where keyboard and screen-reader users continue once the dialog has closed.
  useFocusWhen(shown, revealed);
  useFocusWhen(notice, message);

  const action: SensitiveAction<AdminRevealedContact> = {
    title: copy.revealTitle,
    description: copy.revealBody,
    confirmLabel: copy.reveal,
    busyLabel: copy.revealing,
    reauthBody: copy.reauthBody,
    blockedReason: acknowledged ? null : copy.acknowledgeRequired,
    children: (
      <label className="flex items-start gap-3 text-[0.9375rem] font-semibold">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="check-input mt-0.5"
        />
        <span>{copy.acknowledge}</span>
      </label>
    ),
    run: async () => {
      const result = await inquiryApi.revealContact(inquiry.id, { acknowledgePersonalData: true });

      // A contact for another inquiry is never shown here; treat it as an unreadable answer.
      if (result.id !== inquiry.id || typeof result.contact?.value !== "string") {
        throw new AdminApiError({ kind: "invalid-response", status: 200, outcome: "uncertain" });
      }

      return result;
    },
    onDone: (result) => {
      setOpen(false);
      setMessage(null);
      setRevealed(result);
    },
    onUncertain: () => {
      setOpen(false);
      setRevealed(null);
      setMessage({ tone: "warning", text: copy.uncertain });
    },
    onStale: onGone,
    onForbidden: () => void refreshAccount(),
    onValidation: () => copy.acknowledgeRequired,
  };

  const hide = () => {
    setRevealed(null);
    setMessage({ tone: "info", text: copy.hidden });
  };

  return (
    <div className="grid gap-3">
      {revealed ? (
        <div ref={shown} tabIndex={-1} className="grid gap-3 outline-none">
          <p className="text-meta text-ink-muted">
            {copy.fullLabel}, {t.contactType[revealed.contact.type] ?? revealed.contact.type}
          </p>
          <p className="secret-value">{revealed.contact.value}</p>
          <p role="status" className="text-meta text-ink-muted">
            {copy.revealed(formatTime(revealed.revealed_at, locale) ?? revealed.revealed_at)}{" "}
            {copy.onlyHere}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton value={revealed.contact.value} label={copy.copy} />
            <Button
              variant="quiet"
              icon={<EyeSlash aria-hidden size={18} weight="bold" />}
              onClick={hide}
            >
              {copy.hide}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p>
            <span className="font-mono">{inquiry.contact.masked}</span>
            <span className="mt-1 block text-[0.9375rem] text-ink-muted">
              {t.contactType[inquiry.contact.type] ?? inquiry.contact.type}
            </span>
          </p>
          {canReveal ? (
            <div>
              <Button
                icon={<Eye aria-hidden size={18} weight="bold" />}
                onClick={() => {
                  setMessage(null);
                  setAcknowledged(false);
                  setOpen(true);
                }}
              >
                {copy.reveal}
              </Button>
            </div>
          ) : (
            <p className="text-[0.9375rem] text-ink-muted">{copy.cannotReveal}</p>
          )}
        </>
      )}

      {message ? (
        <Notice ref={notice} tone={message.tone}>
          {message.text}
        </Notice>
      ) : null}

      <SensitiveActionDialog open={open} action={action} onClose={() => setOpen(false)} />
    </div>
  );
}
