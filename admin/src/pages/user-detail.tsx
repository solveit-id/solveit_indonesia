import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { generalErrorCopy } from "~/auth/error-copy";
import { useVerifiedAccount } from "~/auth/use-account";
import { Facts, Fact } from "~/components/account/facts";
import { AuditEventItem } from "~/components/admin/audit-event";
import { accountLabel, accountName, useAccountDirectory } from "~/components/admin/directory";
import { OneTimeLinkReveal } from "~/components/admin/one-time-link-reveal";
import {
  ForbiddenState,
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
import { Button } from "~/components/ui/button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { Panel } from "~/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { StatusCapsule, accountTone, linkTone } from "~/components/ui/status-capsule";
import { useOwnerI18n } from "~/i18n/owner";
import type { OwnerCopy } from "~/i18n/owner";
import { useMotion } from "~/lib/motion";
import { formatDateTime } from "~/lib/time";
import { paths } from "~/routes/paths";
import { type AdminRole, isAdminApiError } from "~/services/admin-api";
import {
  type AdminAuditEvent,
  type AdminIssuedLink,
  type AdminUserDetail,
  administrationApi,
} from "~/services/admin-api/owner";

interface Message {
  tone: NoticeTone;
  text: string;
}

type Loaded =
  | { kind: "loading" }
  | { kind: "failed"; error: unknown }
  | { kind: "ready"; user: AdminUserDetail };

type ActionKind = "role" | "suspend" | "reactivate" | "reset";

const otherRole = (role: AdminRole): AdminRole => (role === "owner" ? "admin" : "owner");

/** Each action keeps its own result type; the dialog only needs the common shape. */
const defineAction = <R,>(action: SensitiveAction<R>): SensitiveAction<unknown> =>
  action as SensitiveAction<unknown>;

/**
 * One admin account (B3.2c): its state as Laravel reports it (`GET users/{id}`), its open link
 * by metadata, its recent audit events, and the owner actions it allows. Every action goes
 * through SensitiveActionDialog: explicit confirmation, the 423 password step, never a resend
 * on its own. A credential reset shows its link once (OneTimeLinkReveal).
 */
export function UserDetail() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const { id } = useParams();
  const userId = /^[1-9][0-9]{0,9}$/.test(id ?? "") ? Number(id) : null;
  const back = { to: paths.users, label: t.userDetail.back };

  if (!hasPermission(account, "users.view")) {
    return (
      <article>
        <PageHeader back={back} title={t.users.title} />
        <div className="mt-10">
          <ForbiddenState />
        </div>
      </article>
    );
  }

  if (userId === null) {
    return <NotFoundAccount />;
  }

  // A different ID is a different screen: nothing of the previous account's state survives.
  return <AccountView key={userId} id={userId} />;
}

function NotFoundAccount() {
  const { t } = useOwnerI18n();

  return (
    <article>
      <PageHeader
        back={{ to: paths.users, label: t.userDetail.back }}
        title={t.userDetail.notFoundTitle}
      />
      <p className="mt-4 max-w-[64ch] text-[1.0625rem] text-ink-muted">
        {t.userDetail.notFoundBody}
      </p>
    </article>
  );
}

function AccountView({ id }: { id: number }) {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [message, setMessage] = useState<Message | null>(null);
  const [uncertain, setUncertain] = useState<ActionKind | null>(null);
  const [checking, setChecking] = useState(false);
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [reveal, setReveal] = useState<AdminIssuedLink | null>(null);
  // Bumped after each change Laravel confirmed: replays the fact highlight, reloads activity.
  const [changes, setChanges] = useState(0);
  const summary = useRef<HTMLDivElement>(null);
  const messageNotice = useRef<HTMLDivElement>(null);
  const uncertainNotice = useRef<HTMLDivElement>(null);
  // A result is where keyboard and screen-reader users continue (the pressed button may be gone).
  useFocusWhen(messageNotice, message);
  useFocusWhen(uncertainNotice, uncertain);

  useEffect(() => {
    const controller = new AbortController();

    administrationApi.getUser(id, controller.signal).then(
      (user) => setLoaded({ kind: "ready", user }),
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

  /** A read of the current state: after a refusal, an uncertain write, or on request. */
  const read = useCallback(async (): Promise<AdminUserDetail | null> => {
    try {
      const user = await administrationApi.getUser(id);
      setLoaded({ kind: "ready", user });

      return user;
    } catch (error) {
      if (!(isAdminApiError(error) && error.kind === "unauthenticated")) {
        setLoaded({ kind: "failed", error });
      }

      return null;
    }
  }, [id]);

  // The facts that an action changed settle in, so the owner sees what moved.
  useMotion(
    ({ gsap }) => {
      if (changes > 0) {
        gsap.from("[data-fact-value]", { x: -6, opacity: 0.35, duration: 0.42, stagger: 0.03 });
      }
    },
    { scope: summary, dependencies: [changes] },
  );

  if (loaded.kind === "loading") {
    return (
      <article>
        <PageHeader
          back={{ to: paths.users, label: t.userDetail.back }}
          title={t.userDetail.loading}
        />
        <div className="mt-10">
          <LoadingState label={t.userDetail.loading} rows={4} />
        </div>
      </article>
    );
  }

  if (loaded.kind === "failed") {
    if (isAdminApiError(loaded.error) && loaded.error.kind === "not-found") {
      return <NotFoundAccount />;
    }

    if (isForbidden(loaded.error)) {
      return (
        <article>
          <PageHeader back={{ to: paths.users, label: t.userDetail.back }} title={t.users.title} />
          <div className="mt-10">
            <ForbiddenState />
          </div>
        </article>
      );
    }

    return (
      <article>
        <PageHeader
          back={{ to: paths.users, label: t.userDetail.back }}
          title={t.userDetail.loadFailed}
        />
        <div className="mt-10">
          <ErrorState
            title={t.userDetail.loadFailed}
            retryLabel={t.common.retry}
            onRetry={() => void read()}
          >
            {generalErrorCopy(loaded.error, t)}
          </ErrorState>
        </div>
      </article>
    );
  }

  const user = loaded.user;
  const name = accountName(user);
  const own = user.is_current_user;
  const target = otherRole(user.role);

  const applied = (next: AdminUserDetail, text: string) => {
    setLoaded({ kind: "ready", user: next });
    setDialog(null);
    setUncertain(null);
    setMessage({ tone: "success", text });
    setChanges((value) => value + 1);
  };

  const common = {
    onUncertain: () => {
      setUncertain(dialog);
      setDialog(null);
      setMessage(null);
    },
    onStale: () => void read(),
    onForbidden: () => void refreshAccount(),
  };

  const actions: Record<ActionKind, SensitiveAction<unknown>> = {
    role: defineAction({
      ...common,
      title: t.roleChange.confirmTitle(name, t.roles[target]),
      description: target === "owner" ? t.roleChange.toOwner : t.roleChange.toAdmin,
      confirmLabel: t.userDetail.makeRole(t.roles[target]),
      busyLabel: t.roleChange.changing,
      run: () => administrationApi.changeRole(id, target),
      onDone: (next) =>
        applied(
          next,
          next.role === user.role
            ? t.userDetail.changed.roleSame(name, t.roles[next.role])
            : t.userDetail.changed.role(name, t.roles[next.role]),
        ),
    }),
    suspend: defineAction({
      ...common,
      title: t.suspension.confirmTitle(name),
      description: t.suspension.confirmBody,
      confirmLabel: t.userDetail.suspend,
      busyLabel: t.suspension.suspending,
      tone: "danger",
      run: () => administrationApi.suspend(id),
      onDone: (next) => applied(next, t.userDetail.changed.suspended(name)),
    }),
    reactivate: defineAction({
      ...common,
      title: t.suspension.reactivateTitle(name),
      description: t.suspension.reactivateBody,
      confirmLabel: t.userDetail.reactivate,
      busyLabel: t.suspension.reactivating,
      run: () => administrationApi.reactivate(id),
      onDone: (next) => applied(next, t.userDetail.changed.reactivated(name)),
    }),
    reset: defineAction({
      ...common,
      title: t.reset.confirmTitle(name),
      description: t.reset.confirmBody,
      confirmLabel: t.reset.confirm,
      busyLabel: t.reset.resetting,
      tone: "danger",
      blockedReason: resetAcknowledged ? null : t.sensitive.acknowledgeRequired,
      children: (
        <label className="flex items-start gap-3 text-[0.9375rem] font-semibold">
          <input
            type="checkbox"
            checked={resetAcknowledged}
            onChange={(event) => setResetAcknowledged(event.target.checked)}
            className="check-input mt-0.5"
          />
          <span>{t.reset.acknowledge}</span>
        </label>
      ),
      run: () => administrationApi.resetCredentials(id, { acknowledgeAccessLoss: true }),
      onDone: (issued) => {
        setLoaded({ kind: "ready", user: issued.account });
        setDialog(null);
        setUncertain(null);
        setMessage(null);
        setReveal(issued.access_link);
        setChanges((value) => value + 1);
      },
      onValidation: () => t.sensitive.acknowledgeRequired,
    }),
  };

  const open = (kind: ActionKind) => {
    setMessage(null);
    setResetAcknowledged(false);
    setDialog(kind);
  };

  /** Resolve an uncertain write by reading the account; never by sending the write again. */
  const check = async () => {
    setChecking(true);
    const kind = uncertain;
    const now = await read();
    setChecking(false);

    if (now === null) {
      return;
    }

    setUncertain(null);
    setMessage(
      kind === "reset" &&
        now.status === "credential-reset-pending" &&
        now.open_access_link?.purpose === "credential-reset"
        ? { tone: "warning", text: t.userDetail.resetUncertainApplied }
        : { tone: "info", text: t.userDetail.checked },
    );
  };

  return (
    <article>
      <div>
        <PageHeader
          back={{ to: paths.users, label: t.userDetail.back }}
          title={name}
          lede={
            <div className="grid gap-3">
              <p className="[overflow-wrap:anywhere]">{user.email}</p>
              <div className="flex flex-wrap gap-2">
                <StatusCapsule
                  status={accountTone[user.status]}
                  label={t.accountStatus[user.status]}
                />
                <span className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-meta font-medium text-ink">
                  {t.roles[user.role]}
                </span>
                {own ? (
                  <span className="inline-flex min-h-7 items-center gap-2 rounded-full border border-line-strong px-3 text-meta font-semibold text-accent-text">
                    <span
                      aria-hidden
                      className="h-1.5 w-3.5 -rotate-[33deg] rounded-full bg-accent"
                    />
                    {t.owner.you}
                  </span>
                ) : null}
              </div>
            </div>
          }
        />
      </div>

      {own || message || uncertain || reveal ? (
        <div className="mt-8 grid max-w-[76rem] gap-4">
          {own ? <Notice tone="info">{t.userDetail.yourAccount}</Notice> : null}
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
                  busyLabel={t.invite.checking}
                  icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
                  onClick={() => void check()}
                >
                  {t.userDetail.checkState}
                </Button>
              }
            >
              {t.userDetail.uncertain}
            </Notice>
          ) : null}
          {reveal ? (
            <OneTimeLinkReveal
              link={reveal}
              title={t.linkReveal.resetTitle(name)}
              lost={t.linkReveal.lostReset}
              onDone={() => {
                setReveal(null);
                // Back to the top of the work area, where the account's new state is.
                document.getElementById("main")?.focus();
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div
        ref={summary}
        className="mt-10 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-x-12"
      >
        <div className="min-w-0 xl:col-start-1">
          <SummaryPanel user={user} />
        </div>
        {own || reveal ? null : (
          <section
            aria-labelledby="actions-title"
            className="rounded-panel border border-line bg-paper-raised p-6 sm:p-7 xl:sticky xl:top-10 xl:col-start-2 xl:row-span-3 xl:row-start-1"
          >
            <h2 id="actions-title" className="text-section font-wide">
              {t.userDetail.actionsTitle}
            </h2>
            <p className="mt-2 text-meta text-ink-muted">{t.userDetail.actionsNote}</p>
            <div className="mt-2 divide-y divide-line">
              {hasPermission(account, "users.change-role") ? (
                <ActionRow
                  title={t.userDetail.roleTitle}
                  body={user.status === "pending" ? null : t.userDetail.roleBody(t.roles[target])}
                  unavailable={user.status === "pending" ? t.userDetail.roleUnavailable : null}
                >
                  <Button onClick={() => open("role")}>
                    {t.userDetail.makeRole(t.roles[target])}
                  </Button>
                </ActionRow>
              ) : null}
              {hasPermission(account, "users.suspend") ? (
                <ActionRow
                  title={t.userDetail.suspendTitle}
                  body={
                    user.status === "suspended"
                      ? t.userDetail.reactivateBody
                      : t.userDetail.suspendBody
                  }
                >
                  {user.status === "suspended" ? (
                    <Button onClick={() => open("reactivate")}>{t.userDetail.reactivate}</Button>
                  ) : (
                    <Button variant="danger" onClick={() => open("suspend")}>
                      {t.userDetail.suspend}
                    </Button>
                  )}
                </ActionRow>
              ) : null}
              {hasPermission(account, "users.reset-credentials") ? (
                <ActionRow
                  title={t.userDetail.resetTitle}
                  body={
                    user.status === "pending" || user.status === "suspended"
                      ? null
                      : t.userDetail.resetBody
                  }
                  unavailable={
                    user.status === "pending"
                      ? t.userDetail.resetUnavailablePending
                      : user.status === "suspended"
                        ? t.userDetail.resetUnavailableSuspended
                        : null
                  }
                >
                  <Button variant="danger" onClick={() => open("reset")}>
                    {user.status === "credential-reset-pending"
                      ? t.userDetail.resetAgain
                      : t.userDetail.reset}
                  </Button>
                </ActionRow>
              ) : null}
            </div>
          </section>
        )}
        <div className="min-w-0 xl:col-start-1">
          <OpenLinkPanel user={user} currentId={account.id} />
        </div>
        {hasPermission(account, "audit.view-all") ? (
          <div className="min-w-0 xl:col-start-1">
            <RecentActivity userId={id} currentId={account.id} version={changes} />
          </div>
        ) : null}
      </div>

      <SensitiveActionDialog
        open={dialog !== null}
        action={dialog === null ? null : actions[dialog]}
        onClose={() => setDialog(null)}
      />
    </article>
  );
}

function ActionRow({
  title,
  body,
  unavailable = null,
  children,
}: {
  title: string;
  body: string | null;
  unavailable?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2.5 py-5 last:pb-0">
      <h3 className="text-item font-semibold">{title}</h3>
      {body ? <p className="text-[0.9375rem] text-ink-muted">{body}</p> : null}
      {unavailable ? (
        <p className="flex gap-2 text-[0.9375rem] text-ink-muted">
          <Info aria-hidden size={18} weight="bold" className="mt-0.5 flex-none" />
          {unavailable}
        </p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

function FactValue({ children }: { children: ReactNode }) {
  return (
    <span data-fact-value className="inline-block">
      {children}
    </span>
  );
}

function SummaryPanel({ user }: { user: AdminUserDetail }) {
  const { t, locale } = useOwnerI18n();
  const copy = t.userDetail;
  const when = (iso: string | null, fallback: string) => formatDateTime(iso, locale) ?? fallback;

  return (
    <Panel title={copy.summaryTitle}>
      <Facts>
        <Fact term={copy.status}>
          <FactValue>
            <span className="font-semibold">{t.accountStatus[user.status]}</span>
          </FactValue>
          <span className="mt-1 block text-[0.9375rem] text-ink-muted">
            {t.accountStatusDetail[user.status]}
          </span>
        </Fact>
        <Fact term={copy.role}>
          <FactValue>{t.roles[user.role]}</FactValue>
        </Fact>
        <Fact term={copy.authenticator}>
          <FactValue>
            {user.two_factor_confirmed ? t.users.authenticatorOn : t.users.authenticatorOff}
          </FactValue>
        </Fact>
        <Fact term={copy.sessions}>
          <FactValue>{copy.sessionsValue(user.active_sessions)}</FactValue>
          <span className="mt-1 block text-[0.9375rem] text-ink-muted">{copy.sessionsNote}</span>
        </Fact>
        <Fact term={copy.lastLogin}>{when(user.last_login_at, t.owner.never)}</Fact>
        <Fact term={copy.activatedAt}>{when(user.activated_at, t.common.notRecorded)}</Fact>
        {user.suspended_at ? (
          <Fact term={copy.suspendedAt}>
            <FactValue>{when(user.suspended_at, t.common.notRecorded)}</FactValue>
          </Fact>
        ) : null}
        <Fact term={copy.createdAt}>{when(user.created_at, t.common.notRecorded)}</Fact>
      </Facts>
    </Panel>
  );
}

function issuerText(
  issuer: number | null,
  currentId: number,
  directory: ReturnType<typeof useAccountDirectory>,
  t: OwnerCopy,
): string {
  return issuer === null ? t.owner.shell : accountLabel(issuer, directory, currentId, t);
}

function OpenLinkPanel({ user, currentId }: { user: AdminUserDetail; currentId: number }) {
  const { t, locale } = useOwnerI18n();
  const link = user.open_access_link;
  const copy = t.userDetail;
  const issuer = link?.issued_by_user_id ?? null;
  const directory = useAccountDirectory(issuer !== null && issuer !== currentId);

  return (
    <Panel title={copy.openLinkTitle}>
      {link === null ? (
        <p className="text-ink-muted">{copy.openLinkNone}</p>
      ) : (
        <>
          <Facts>
            <Fact term={copy.linkPurpose}>{t.linkPurpose[link.purpose]}</Fact>
            <Fact term={copy.linkStatus}>
              <StatusCapsule status={linkTone[link.status]} label={t.linkStatus[link.status]} />
            </Fact>
            <Fact term={copy.linkIssued}>
              {formatDateTime(link.created_at, locale) ?? t.common.notRecorded}
              <span className="block text-[0.9375rem] text-ink-muted">
                {copy.linkIssuedBy} {issuerText(issuer, currentId, directory, t)}
              </span>
            </Fact>
            <Fact term={copy.linkExpires}>
              {formatDateTime(link.expires_at, locale) ?? link.expires_at}
            </Fact>
          </Facts>
          <p className="mt-4 text-[0.9375rem] text-ink-muted">{copy.linkNote}</p>
        </>
      )}
    </Panel>
  );
}

const RECENT_EVENTS = 5;

function RecentActivity({
  userId,
  currentId,
  version,
}: {
  userId: number;
  currentId: number;
  version: number;
}) {
  const { t } = useOwnerI18n();
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "failed" } | { kind: "ready"; events: AdminAuditEvent[] }
  >({ kind: "loading" });
  const directory = useAccountDirectory();
  const copy = t.userDetail;

  useEffect(() => {
    const controller = new AbortController();

    administrationApi
      .listAuditEvents(
        { subject_user_id: userId },
        { perPage: RECENT_EVENTS, signal: controller.signal },
      )
      .then(
        (page) => setState({ kind: "ready", events: page.data }),
        (error: unknown) => {
          if (
            !controller.signal.aborted &&
            !(isAdminApiError(error) && error.kind === "unauthenticated")
          ) {
            setState({ kind: "failed" });
          }
        },
      );

    return () => controller.abort();
  }, [userId, version]);

  return (
    <section
      aria-labelledby="recent-title"
      className="rounded-panel border border-line bg-paper-raised p-6 sm:p-7"
    >
      <h2 id="recent-title" className="text-section font-wide">
        {copy.recentTitle}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">{copy.recentBody}</p>
      <div className="mt-5">
        {state.kind === "loading" ? <LoadingState label={copy.recentTitle} rows={3} /> : null}
        {state.kind === "failed" ? <p className="text-ink-muted">{copy.recentFailed}</p> : null}
        {state.kind === "ready" && state.events.length === 0 ? (
          <EmptyState title={copy.recentEmpty}>{t.audit.emptyBody}</EmptyState>
        ) : null}
        {state.kind === "ready" && state.events.length > 0 ? (
          <ol className="relative">
            <span aria-hidden className="timeline-spine" />
            {state.events.map((event) => (
              <AuditEventItem
                key={event.id}
                event={event}
                directory={directory}
                currentId={currentId}
                showDate
              />
            ))}
          </ol>
        ) : null}
      </div>
      <Link
        to={`${paths.audit}?subjek=${userId}`}
        className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        {copy.recentAll}
        <ArrowRight aria-hidden size={16} weight="bold" />
      </Link>
    </section>
  );
}
