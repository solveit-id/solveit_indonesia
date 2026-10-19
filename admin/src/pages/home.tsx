import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Tray } from "@phosphor-icons/react/dist/csr/Tray";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import type { ComponentType } from "react";
import { Link } from "react-router";
import { type Phase, phases } from "~/app/phases";
import { useVerifiedAccount } from "~/auth/use-account";
import { SessionFacts } from "~/components/account/facts";
import { Notice } from "~/components/ui/notice";
import { Panel } from "~/components/ui/panel";
import { PhaseGlyph, StatusCapsule } from "~/components/ui/status-capsule";
import { useI18n } from "~/i18n/i18n";
import type { Messages } from "~/i18n/messages/id";
import { cn } from "~/lib/cn";
import { paths } from "~/routes/paths";

/** Below this many recovery codes the home screen suggests creating new ones. */
const LOW_RECOVERY_CODES = 3;

/**
 * The signed-in home (owner decision 2026-10-17): who is signed in, this session's limits,
 * the way to the account's security, and the honest phase track. Accounts that handle inquiries
 * get the way there (B4b), owners the way into administration (B3.2c), each by permission from
 * `GET me`. No metrics, counts, or modules that do not exist.
 * Rendered only after the private loader verified the account.
 */
export function Home() {
  const { t } = useI18n();
  const account = useVerifiedAccount();
  const role = account.role === null ? t.roles.none : t.roles[account.role];
  const remaining = account.two_factor.recovery_codes_remaining;
  const canViewUsers = account.permissions.includes("users.view");
  const canReadAudit = account.permissions.includes("audit.view-all");
  const canViewInquiries = account.permissions.includes("inquiries.view");

  return (
    <article>
      <header className="max-w-[64ch]">
        <h1 className="text-page font-wide">{t.home.title}</h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">
          {t.home.lede(account.name, role)}
        </p>
      </header>

      {remaining < LOW_RECOVERY_CODES ? (
        <Notice tone="warning" className="mt-8 max-w-[52rem]">
          {t.home.lowCodes(remaining)}{" "}
          <Link
            to={paths.security}
            className="font-semibold text-accent-text underline underline-offset-4"
          >
            {t.nav.security}
          </Link>
        </Notice>
      ) : null}

      <div className="mt-12 grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-14">
        <PhaseTrack />
        <div className="grid gap-6 xl:sticky xl:top-10">
          <Panel title={t.home.sessionTitle}>
            <SessionFacts />
          </Panel>
          <nav aria-label={t.home.shortcutsTitle} className="grid gap-3">
            {/* Each link carries the state it leads to, not a repeat of the navigation. */}
            <Shortcut
              to={paths.account}
              icon={UserCircle}
              title={t.home.accountLink}
              detail={`${role}, ${
                account.two_factor.confirmed_at === null
                  ? t.home.authenticatorOff
                  : t.home.authenticatorOn
              }`}
            />
            <Shortcut
              to={paths.security}
              icon={ShieldCheck}
              title={t.home.securityLink}
              detail={`${t.account.recoveryCodes}: ${t.account.recoveryRemaining(remaining)}`}
            />
          </nav>
          {canViewInquiries ? (
            <nav aria-label={t.home.operationsTitle} className="grid gap-3">
              <h2 className="text-item font-semibold font-wide">{t.home.operationsTitle}</h2>
              <Shortcut
                to={paths.inquiries}
                icon={Tray}
                title={t.home.inquiriesLink}
                detail={t.home.inquiriesDetail}
              />
            </nav>
          ) : null}
          {canViewUsers || canReadAudit ? (
            <nav aria-label={t.home.administrationTitle} className="grid gap-3">
              <h2 className="text-item font-semibold font-wide">{t.home.administrationTitle}</h2>
              {canViewUsers ? (
                <>
                  <Shortcut
                    to={paths.users}
                    icon={UsersThree}
                    title={t.home.usersLink}
                    detail={t.home.usersDetail}
                  />
                  <Shortcut
                    to={paths.invitations}
                    icon={EnvelopeSimple}
                    title={t.home.invitationsLink}
                    detail={t.home.invitationsDetail}
                  />
                </>
              ) : null}
              {canReadAudit ? (
                <Shortcut
                  to={paths.audit}
                  icon={ClockCounterClockwise}
                  title={t.home.auditLink}
                  detail={t.home.auditDetail}
                />
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Shortcut({
  to,
  icon: Icon,
  title,
  detail,
}: {
  to: string;
  icon: ComponentType<{
    size?: number;
    weight?: "bold";
    "aria-hidden"?: boolean;
    className?: string;
  }>;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-[1.25rem] border border-line bg-paper-raised px-5 py-4 transition-colors duration-[var(--dur-state)] hover:border-line-strong"
    >
      <Icon aria-hidden size={22} weight="bold" className="flex-none text-accent-text" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-meta text-ink-muted">{detail}</span>
      </span>
      <span
        aria-hidden
        className="inline-flex size-9 flex-none items-center justify-center rounded-full border border-line-strong text-ink transition-transform duration-[var(--dur-state)] group-hover:translate-x-0.5"
      >
        <ArrowRight size={16} weight="bold" />
      </span>
    </Link>
  );
}

function PhaseTrack() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="phases-title">
      <h2 id="phases-title" className="text-section font-wide">
        {t.phases.title}
      </h2>
      <p className="mt-2 max-w-[60ch] text-ink-muted">{t.phases.intro}</p>

      <ol className="relative mt-7 grid gap-1.5">
        {/* One spine through every phase, as on the website's ecosystem map. */}
        <span aria-hidden className="absolute top-6 bottom-6 left-[1.6rem] w-px bg-line-strong" />
        {phases.map((phase) => (
          <PhaseRow key={phase.code} phase={phase} t={t} />
        ))}
      </ol>
    </section>
  );
}

function PhaseRow({ phase, t }: { phase: Phase; t: Messages }) {
  const copy = t.phases.items[phase.code];
  const current = phase.status === "current";

  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "relative grid grid-cols-[3.2rem_minmax(0,1fr)] gap-x-2 rounded-[1.25rem] py-4 pr-4",
        current && "bg-paper-raised ring-1 ring-line",
      )}
    >
      <span className="relative flex justify-center pt-1.5">
        {/* A ground-coloured disc lets the glyph sit on the spine without the line showing through. */}
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full",
            current ? "bg-paper-raised" : "bg-paper",
          )}
        >
          <PhaseGlyph status={phase.status} />
        </span>
      </span>
      <div className="min-w-0">
        {/* The code is part of the heading, so a long title wraps after it, never under it. */}
        <h3 className="text-item font-wide">
          <span className="mr-3 text-meta font-semibold text-ink-muted tabular-nums">
            {phase.label}
          </span>
          {copy.title}
        </h3>
        <p className="mt-1.5 max-w-[62ch] text-[0.9375rem] text-ink-muted">{copy.detail}</p>
        <div className="mt-3">
          <StatusCapsule
            status={phase.status}
            label={t.phases.status[phase.status]}
            glyph={false}
          />
        </div>
      </div>
    </li>
  );
}
