import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { UserPlus } from "@phosphor-icons/react/dist/csr/UserPlus";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useVerifiedAccount } from "~/auth/use-account";
import {
  type AccountDirectory,
  accountLabel,
  useAccountDirectory,
} from "~/components/admin/directory";
import {
  ForbiddenState,
  ListFooter,
  PageHeader,
  hasPermission,
  isForbidden,
  listErrorCopy,
  refreshAccount,
  useFocusAppended,
  useFocusWhen,
  useRowEntrance,
} from "~/components/admin/owner-ui";
import {
  type SensitiveAction,
  SensitiveActionDialog,
} from "~/components/admin/sensitive-action-dialog";
import { useCursorList } from "~/components/admin/use-cursor-list";
import { Button } from "~/components/ui/button";
import { Notice, type NoticeTone } from "~/components/ui/notice";
import { SelectField } from "~/components/ui/select-field";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { StatusCapsule, linkTone } from "~/components/ui/status-capsule";
import { useOwnerI18n } from "~/i18n/owner";
import type { OwnerCopy } from "~/i18n/owner";
import { cn } from "~/lib/cn";
import { WIDE_TABLE_QUERY, useMediaQuery } from "~/lib/media";
import { formatDateTime } from "~/lib/time";
import { paths } from "~/routes/paths";
import {
  type AdminAccessLinkStatus,
  type AdminInvitation,
  type AdminInvitationFilters,
  adminAccessLinkStatuses,
  administrationApi,
} from "~/services/admin-api/owner";

const listInvitations = administrationApi.listInvitations;

function readFilters(params: URLSearchParams): AdminInvitationFilters {
  const status = params.get("status");

  return {
    status: (adminAccessLinkStatuses as readonly string[]).includes(status ?? "")
      ? (status as AdminAccessLinkStatus)
      : undefined,
  };
}

/** Pending and redeemed invitations can still be revoked (admin-users.md, DELETE invitations). */
const revocable = (invitation: AdminInvitation) =>
  invitation.status === "pending" || invitation.status === "redeemed";

interface Message {
  tone: NoticeTone;
  text: string;
  reload?: boolean;
}

/**
 * Invitations (B3.2c): activation links by their metadata (`GET invitations`, newest first).
 * The link itself appears only once, on the invite screen; here an owner sees the status and
 * may revoke a pending or redeemed invitation after an explicit confirmation.
 */
export function Invitations() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const allowed = hasPermission(account, "users.view");

  return (
    <article>
      <PageHeader
        title={t.invitations.title}
        lede={t.invitations.lede}
        action={
          allowed && hasPermission(account, "users.invite") ? (
            <Link to={paths.invite} className="btn btn-primary">
              <UserPlus aria-hidden size={18} weight="bold" />
              {t.invitations.invite}
            </Link>
          ) : null
        }
      />
      <div className="mt-10">{allowed ? <InvitationList /> : <ForbiddenState />}</div>
    </article>
  );
}

function InvitationList() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const { state, loadMore, moreBusy, moreError, reload, update } = useCursorList(
    listInvitations,
    filters,
  );
  const directory = useAccountDirectory();
  // Six columns: a table only from 1024px; cards on tablets and phones.
  const wide = useMediaQuery(WIDE_TABLE_QUERY);
  const rows = useRef<HTMLDivElement>(null);
  const [revoking, setRevoking] = useState<AdminInvitation | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const messageNotice = useRef<HTMLDivElement>(null);
  // The revoked row loses its button: the result notice is where focus continues.
  useFocusWhen(messageNotice, message);
  const canRevoke = hasPermission(account, "users.invite");

  const ready = state.status === "ready" ? state : null;
  useRowEntrance(rows, ready?.revision ?? null, ready?.appendedFrom ?? 0);
  useFocusAppended(rows, ready?.appendedFrom ?? null);

  const setStatus = (value: string) =>
    setParams(value === "" ? {} : { status: value }, { replace: true, preventScrollReset: true });

  if (state.status === "failed" && isForbidden(state.error)) {
    return <ForbiddenState />;
  }

  const email = (invitation: AdminInvitation | null) =>
    invitation?.account?.email ?? t.invitations.noAccount;

  const revokeAction: SensitiveAction<AdminInvitation> | null = revoking
    ? {
        title: t.invitations.revokeTitle,
        description: t.invitations.revokeBody(email(revoking)),
        confirmLabel: t.invitations.revoke,
        busyLabel: t.invitations.revoking,
        tone: "danger",
        run: () => administrationApi.revokeInvitation(revoking.id),
        onDone: (revoked) => {
          update((item) => (item.id === revoked.id ? revoked : item));
          setRevoking(null);
          setMessage({ tone: "success", text: t.invitations.revoked(email(revoked)) });
        },
        onUncertain: () => {
          setRevoking(null);
          setMessage({ tone: "warning", text: t.invitations.revokeUncertain, reload: true });
        },
        onStale: reload,
        onForbidden: () => void refreshAccount(),
      }
    : null;

  return (
    <section aria-label={t.invitations.listLabel}>
      <div
        role="group"
        aria-label={t.owner.filtersLabel}
        className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6"
      >
        <SelectField
          label={t.owner.statusFilter}
          className="w-full sm:w-[16rem]"
          value={filters.status ?? ""}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">{t.owner.allStatuses}</option>
          {adminAccessLinkStatuses.map((status) => (
            <option key={status} value={status}>
              {t.linkStatus[status]}
            </option>
          ))}
        </SelectField>
        {filters.status ? (
          <Button variant="quiet" onClick={() => setStatus("")}>
            {t.owner.clearFilters}
          </Button>
        ) : null}
      </div>

      {message ? (
        <Notice
          ref={messageNotice}
          tone={message.tone}
          className="mt-6"
          action={
            message.reload ? (
              <Button
                icon={<ArrowsClockwise aria-hidden size={18} weight="bold" />}
                onClick={() => {
                  setMessage(null);
                  reload();
                }}
              >
                {t.invitations.reload}
              </Button>
            ) : undefined
          }
        >
          {message.text}
        </Notice>
      ) : null}

      <div className="mt-6">
        {state.status === "loading" ? (
          <LoadingState label={t.invitations.loading} rows={4} />
        ) : null}

        {state.status === "failed" ? (
          <ErrorState title={t.invitations.loadFailed} retryLabel={t.common.retry} onRetry={reload}>
            {listErrorCopy(state.error, t)}
          </ErrorState>
        ) : null}

        {ready && ready.items.length === 0 ? (
          filters.status ? (
            <EmptyState
              title={t.invitations.emptyFiltered}
              action={<Button onClick={() => setStatus("")}>{t.owner.clearFilters}</Button>}
            >
              {t.invitations.emptyFilteredBody}
            </EmptyState>
          ) : (
            <EmptyState
              title={t.invitations.empty}
              action={
                canRevoke ? (
                  <Link to={paths.invite} className="btn btn-secondary">
                    {t.invitations.invite}
                  </Link>
                ) : undefined
              }
            >
              {t.invitations.emptyBody}
            </EmptyState>
          )
        ) : null}

        {ready && ready.items.length > 0 ? (
          <>
            <div
              ref={rows}
              aria-busy={ready.refreshing || undefined}
              className={cn(ready.refreshing && "list-stale")}
            >
              {wide ? (
                <InvitationTable
                  invitations={ready.items}
                  directory={directory}
                  currentId={account.id}
                  onRevoke={canRevoke ? setRevoking : null}
                />
              ) : (
                <InvitationCards
                  invitations={ready.items}
                  directory={directory}
                  currentId={account.id}
                  onRevoke={canRevoke ? setRevoking : null}
                />
              )}
            </div>
            <ListFooter
              summary={
                ready.refreshing
                  ? t.owner.refreshing
                  : t.invitations.showing(ready.items.length, ready.hasMore)
              }
              hasMore={ready.hasMore && !ready.refreshing}
              busy={moreBusy}
              error={moreError}
              loadLabel={t.owner.loadMore}
              onLoadMore={() => void loadMore()}
            />
          </>
        ) : null}
      </div>

      <SensitiveActionDialog
        open={revokeAction !== null}
        action={revokeAction as SensitiveAction<unknown> | null}
        onClose={() => setRevoking(null)}
      />
    </section>
  );
}

interface RowsProps {
  invitations: AdminInvitation[];
  directory: AccountDirectory | null;
  currentId: number;
  onRevoke: ((invitation: AdminInvitation) => void) | null;
}

function issuer(invitation: AdminInvitation, props: RowsProps, t: OwnerCopy) {
  return t.invitations.issuedBy(
    invitation.issued_by_user_id === null
      ? t.owner.shell
      : accountLabel(invitation.issued_by_user_id, props.directory, props.currentId, t),
  );
}

function RevokeButton({
  invitation,
  onRevoke,
}: {
  invitation: AdminInvitation;
  onRevoke: RowsProps["onRevoke"];
}) {
  const { t } = useOwnerI18n();

  if (onRevoke === null || !revocable(invitation)) {
    return null;
  }

  return (
    <Button
      variant="danger"
      className="min-h-10 px-4"
      aria-label={t.invitations.revokeFor(invitation.account?.email ?? t.invitations.noAccount)}
      onClick={() => onRevoke(invitation)}
    >
      {t.invitations.revoke}
    </Button>
  );
}

function InvitationTable(props: RowsProps) {
  const { t, locale } = useOwnerI18n();
  const columns = t.invitations.columns;

  return (
    <table className="data-table">
      <caption className="sr-only">{t.invitations.listLabel}</caption>
      <thead>
        <tr>
          <th scope="col">{columns.address}</th>
          <th scope="col">{columns.role}</th>
          <th scope="col">{columns.status}</th>
          <th scope="col">{columns.issued}</th>
          <th scope="col">{columns.expires}</th>
          <th scope="col">
            <span className="sr-only">{columns.actions}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {props.invitations.map((invitation) => (
          <tr key={invitation.id} data-row>
            <td className="max-w-[20rem] font-semibold [overflow-wrap:anywhere]">
              {invitation.account?.email ?? t.invitations.noAccount}
            </td>
            <td>{invitation.account?.role ? t.roles[invitation.account.role] : t.roles.none}</td>
            <td>
              <StatusCapsule
                status={linkTone[invitation.status]}
                label={t.linkStatus[invitation.status]}
              />
            </td>
            <td className="text-ink-muted tabular-nums">
              {formatDateTime(invitation.created_at, locale) ?? t.common.notRecorded}
              <span className="block text-meta">{issuer(invitation, props, t)}</span>
            </td>
            <td className="text-ink-muted tabular-nums">
              {formatDateTime(invitation.expires_at, locale) ?? invitation.expires_at}
            </td>
            <td className="text-right">
              <RevokeButton invitation={invitation} onRevoke={props.onRevoke} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvitationCards(props: RowsProps) {
  const { t, locale } = useOwnerI18n();
  const columns = t.invitations.columns;

  return (
    <ul aria-label={t.invitations.listLabel} className="grid gap-3">
      {props.invitations.map((invitation) => (
        <li
          key={invitation.id}
          data-row
          className="rounded-[1.25rem] border border-line bg-paper-raised px-5 py-4"
        >
          <p className="font-semibold [overflow-wrap:anywhere] text-ink">
            {invitation.account?.email ?? t.invitations.noAccount}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusCapsule
              status={linkTone[invitation.status]}
              label={t.linkStatus[invitation.status]}
            />
            <span className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-meta font-medium">
              {invitation.account?.role ? t.roles[invitation.account.role] : t.roles.none}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-meta">
            <dt className="text-ink-muted">{columns.issued}</dt>
            <dd className="tabular-nums">
              {formatDateTime(invitation.created_at, locale) ?? t.common.notRecorded},{" "}
              {issuer(invitation, props, t)}
            </dd>
            <dt className="text-ink-muted">{columns.expires}</dt>
            <dd className="tabular-nums">
              {formatDateTime(invitation.expires_at, locale) ?? invitation.expires_at}
            </dd>
          </dl>
          {props.onRevoke && revocable(invitation) ? (
            <div className="mt-4">
              <RevokeButton invitation={invitation} onRevoke={props.onRevoke} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
