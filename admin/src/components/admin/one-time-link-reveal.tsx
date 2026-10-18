import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { useId, useRef, useState } from "react";
import { useFocusWhen } from "~/components/admin/owner-ui";
import { AssemblingMark } from "~/components/brand/assembling-mark";
import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import { LeaveGuard } from "~/components/ui/leave-guard";
import { useOwnerI18n } from "~/i18n/owner";
import { useMotion } from "~/lib/motion";
import { formatDateTime } from "~/lib/time";
import type { AdminIssuedLink } from "~/services/admin-api/owner";

/**
 * An invitation or credential-reset link, shown exactly once (docs/api/admin-users.md: the raw
 * link exists only in the response that issued it). It lives in the memory of the component
 * that received it and nowhere else: never in browser storage, the address, router state, the
 * document title, an attribute, or a log; Done drops it and nothing can show it again. Copying
 * happens only on an explicit press. Until the owner confirms they secured the link, leaving is
 * interrupted (LeaveGuard). The heading takes focus on arrival so the moment is announced.
 */
export function OneTimeLinkReveal({
  link,
  title,
  lost,
  onDone,
}: {
  link: AdminIssuedLink;
  title: string;
  /** What to do when the link is lost (revoke and invite again, or issue a new reset). */
  lost: string;
  onDone: () => void;
}) {
  const { t, locale } = useOwnerI18n();
  const [acknowledged, setAcknowledged] = useState(false);
  const [remind, setRemind] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const checkbox = useRef<HTMLInputElement>(null);
  const id = useId();
  const copy = t.linkReveal;

  // On arrival, after the confirmation dialog has closed and returned focus (useFocusWhen).
  useFocusWhen(heading, link.url);

  // After the mark has assembled, the link and its instructions settle in beneath it.
  useMotion(
    ({ gsap }) => {
      gsap.from("[data-reveal-rest]", {
        y: 10,
        opacity: 0,
        duration: 0.36,
        delay: 0.22,
        stagger: 0.05,
      });
    },
    { scope: panel },
  );

  const finish = () => {
    if (!acknowledged) {
      setRemind(true);
      checkbox.current?.focus();

      return;
    }

    onDone();
  };

  return (
    <section
      ref={panel}
      aria-labelledby={`${id}-title`}
      className="grid gap-6 rounded-panel border border-line-strong bg-paper-raised p-6 sm:p-8"
    >
      <div className="flex items-start gap-5">
        <AssemblingMark className="h-14 w-auto flex-none" />
        <div className="min-w-0">
          <h2
            ref={heading}
            id={`${id}-title`}
            tabIndex={-1}
            className="text-section break-words font-wide outline-none"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-[64ch] text-[0.9375rem] text-ink-muted">{copy.lede}</p>
        </div>
      </div>

      <div data-reveal-rest>
        <p id={`${id}-label`} className="text-[0.9375rem] font-semibold">
          {copy.linkLabel}
        </p>
        <code aria-labelledby={`${id}-label`} className="mt-2 secret-value">
          {link.url}
        </code>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <CopyButton value={link.url} label={copy.copy} />
          <span className="text-meta text-ink-muted">
            {copy.validUntil(formatDateTime(link.expires_at, locale) ?? link.expires_at)}
          </span>
        </div>
      </div>

      <div data-reveal-rest className="grid max-w-[64ch] gap-2 text-[0.9375rem]">
        <p className="text-ink">{copy.handOver}</p>
        <p className="text-ink-muted">{lost}</p>
      </div>

      <div data-reveal-rest className="grid gap-4 border-t border-line pt-5">
        <div className="grid gap-2">
          <label className="flex items-start gap-3 text-[0.9375rem] font-semibold">
            <input
              ref={checkbox}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked);
                setRemind(false);
              }}
              aria-describedby={remind ? `${id}-remind` : undefined}
              className="check-input mt-0.5"
            />
            <span>{copy.acknowledge}</span>
          </label>
          {remind ? (
            <p id={`${id}-remind`} role="alert" className="text-meta font-medium text-danger">
              {copy.acknowledgeFirst}
            </p>
          ) : null}
        </div>
        <div>
          <Button
            variant="primary"
            onClick={finish}
            icon={<Check aria-hidden size={18} weight="bold" />}
          >
            {copy.done}
          </Button>
        </div>
      </div>

      <LeaveGuard
        active={!acknowledged}
        title={copy.leaveTitle}
        body={copy.leaveBody}
        stayLabel={copy.stay}
        leaveLabel={copy.leave}
      />
    </section>
  );
}
