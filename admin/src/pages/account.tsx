import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Link } from "react-router";
import { useVerifiedAccount } from "~/auth/use-account";
import { Fact, Facts, SessionFacts } from "~/components/account/facts";
import { Panel } from "~/components/ui/panel";
import { useI18n } from "~/i18n/i18n";
import { formatDateTime } from "~/lib/time";
import { paths } from "~/routes/paths";

/**
 * The signed-in account exactly as `GET me` returns it. Read-only: there is no profile-edit
 * endpoint (docs/api/admin-auth.md, Yang tidak ada), so nothing here looks editable.
 */
export function Account() {
  const { t, locale } = useI18n();
  const account = useVerifiedAccount();
  const role = account.role ?? "none";
  const confirmedAt = formatDateTime(account.two_factor.confirmed_at, locale);

  return (
    <article>
      <header className="max-w-[64ch]">
        <h1 className="text-page font-wide">{t.account.title}</h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-muted">{t.account.lede}</p>
      </header>

      <div className="mt-12 grid max-w-[52rem] gap-6">
        <Panel title={t.account.profileTitle}>
          <Facts>
            <Fact term={t.account.name}>{account.name}</Fact>
            <Fact term={t.account.email}>
              <span className="break-all">{account.email}</span>
            </Fact>
            <Fact term={t.account.role}>
              <span className="font-semibold">
                {account.role === null ? t.roles.none : t.roles[account.role]}
              </span>
              <span className="mt-1 block text-[0.9375rem] text-ink-muted">
                {t.account.roleDetail[role]}
              </span>
            </Fact>
          </Facts>
        </Panel>

        <Panel title={t.account.authenticatorTitle}>
          <Facts>
            <Fact term={t.account.totp}>
              {confirmedAt ? t.account.totpActive(confirmedAt) : t.account.totpMissing}
            </Fact>
            <Fact term={t.account.recoveryCodes}>
              {t.account.recoveryRemaining(account.two_factor.recovery_codes_remaining)}
            </Fact>
          </Facts>
        </Panel>

        <Panel title={t.account.sessionTitle}>
          <SessionFacts />
        </Panel>

        <div>
          <Link to={paths.security} className="btn btn-secondary">
            {t.account.manageSecurity}
            <ArrowRight aria-hidden size={18} weight="bold" />
          </Link>
        </div>
      </div>
    </article>
  );
}
