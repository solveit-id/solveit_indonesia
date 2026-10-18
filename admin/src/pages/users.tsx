import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { UserPlus } from "@phosphor-icons/react/dist/csr/UserPlus";
import { useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { useVerifiedAccount } from "~/auth/use-account";
import {
  ForbiddenState,
  ListFooter,
  PageHeader,
  hasPermission,
  isForbidden,
  listErrorCopy,
  useFocusAppended,
  useRowEntrance,
} from "~/components/admin/owner-ui";
import { accountName } from "~/components/admin/directory";
import { useCursorList } from "~/components/admin/use-cursor-list";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { SelectField } from "~/components/ui/select-field";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { StatusCapsule, accountTone } from "~/components/ui/status-capsule";
import { useOwnerI18n } from "~/i18n/owner";
import type { OwnerCopy } from "~/i18n/owner";
import { cn } from "~/lib/cn";
import { TABLE_QUERY, useMediaQuery } from "~/lib/media";
import { formatDateTime } from "~/lib/time";
import { paths, userPath } from "~/routes/paths";
import { type AdminRole } from "~/services/admin-api";
import {
  type AdminAccountStatus,
  type AdminUser,
  type AdminUserFilters,
  adminAccountStatuses,
  adminRoles,
  administrationApi,
} from "~/services/admin-api/owner";

const listUsers = administrationApi.listUsers;

/** Filters live in the address (`?peran=admin&status=suspended`); unknown values are ignored. */
function readFilters(params: URLSearchParams): AdminUserFilters {
  const role = params.get("peran");
  const status = params.get("status");

  return {
    role: (adminRoles as readonly string[]).includes(role ?? "") ? (role as AdminRole) : undefined,
    status: (adminAccountStatuses as readonly string[]).includes(status ?? "")
      ? (status as AdminAccountStatus)
      : undefined,
  };
}

/**
 * Users (B3.2c): every admin account as Laravel lists it (`GET users`, owner only), filtered by
 * role and status, newest pages loaded on request. Rows lead to the account's detail, where the
 * actions are. No count or metric beyond the rows actually loaded.
 */
export function Users() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const allowed = hasPermission(account, "users.view");

  return (
    <article>
      <PageHeader
        title={t.users.title}
        lede={t.users.lede}
        action={
          allowed && hasPermission(account, "users.invite") ? (
            <Link to={paths.invite} className="btn btn-primary">
              <UserPlus aria-hidden size={18} weight="bold" />
              {t.users.invite}
            </Link>
          ) : null
        }
      />
      <div className="mt-10">{allowed ? <UserList /> : <ForbiddenState />}</div>
    </article>
  );
}

function UserList() {
  const { t } = useOwnerI18n();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const { state, loadMore, moreBusy, moreError, reload } = useCursorList(listUsers, filters);
  const wide = useMediaQuery(TABLE_QUERY);
  const rows = useRef<HTMLDivElement>(null);
  const filtered = filters.role !== undefined || filters.status !== undefined;

  const ready = state.status === "ready" ? state : null;
  useRowEntrance(rows, ready?.revision ?? null, ready?.appendedFrom ?? 0);
  useFocusAppended(rows, ready?.appendedFrom ?? null);

  const setFilter = (key: "peran" | "status", value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }

        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const clearFilters = () => setParams({}, { replace: true, preventScrollReset: true });

  if (state.status === "failed" && isForbidden(state.error)) {
    return <ForbiddenState />;
  }

  return (
    <section aria-label={t.users.listLabel}>
      <div
        role="group"
        aria-label={t.owner.filtersLabel}
        className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6"
      >
        <SegmentedControl
          legend={t.owner.roleFilter}
          legendVisible
          className="w-full sm:w-auto sm:min-w-[22rem]"
          value={filters.role ?? "all"}
          options={[
            { value: "all", label: t.owner.allRoles },
            ...adminRoles.map((role) => ({ value: role, label: t.roles[role] })),
          ]}
          onChange={(value) => setFilter("peran", value === "all" ? "" : value)}
        />
        <SelectField
          label={t.owner.statusFilter}
          className="w-full sm:w-[15rem]"
          value={filters.status ?? ""}
          onChange={(event) => setFilter("status", event.target.value)}
        >
          <option value="">{t.owner.allStatuses}</option>
          {adminAccountStatuses.map((status) => (
            <option key={status} value={status}>
              {t.accountStatus[status]}
            </option>
          ))}
        </SelectField>
        {filtered ? (
          <Button variant="quiet" className="sm:mb-0" onClick={clearFilters}>
            {t.owner.clearFilters}
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        {state.status === "loading" ? <LoadingState label={t.users.loading} rows={4} /> : null}

        {state.status === "failed" ? (
          <ErrorState title={t.users.loadFailed} retryLabel={t.common.retry} onRetry={reload}>
            {listErrorCopy(state.error, t)}
          </ErrorState>
        ) : null}

        {ready && ready.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title={t.users.emptyFiltered}
              action={<Button onClick={clearFilters}>{t.owner.clearFilters}</Button>}
            >
              {t.users.emptyFilteredBody}
            </EmptyState>
          ) : (
            <EmptyState title={t.users.empty}>{t.users.emptyBody}</EmptyState>
          )
        ) : null}

        {ready && ready.items.length > 0 ? (
          <>
            <div
              ref={rows}
              aria-busy={ready.refreshing || undefined}
              className={cn(ready.refreshing && "list-stale")}
            >
              {wide ? <UserTable users={ready.items} /> : <UserCards users={ready.items} />}
            </div>
            <ListFooter
              summary={
                ready.refreshing
                  ? t.owner.refreshing
                  : t.users.showing(ready.items.length, ready.hasMore)
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
    </section>
  );
}

function lastLogin(user: AdminUser, t: OwnerCopy, locale: "id" | "en") {
  return formatDateTime(user.last_login_at, locale) ?? t.owner.never;
}

function NameCell({ user }: { user: AdminUser }) {
  const { t } = useOwnerI18n();

  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Link
          to={userPath(user.id)}
          className="row-link font-semibold [overflow-wrap:anywhere] text-ink"
        >
          {accountName(user)}
        </Link>
        {user.is_current_user ? (
          <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-accent-text">
            <span aria-hidden className="h-1.5 w-3.5 -rotate-[33deg] rounded-full bg-accent" />
            {t.owner.you}
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-meta [overflow-wrap:anywhere] text-ink-muted">
        {/* Invited, not accepted yet: the address is the link, and this line says why. */}
        {user.name.trim() === "" ? t.owner.unnamed : user.email}
      </p>
    </div>
  );
}

function UserTable({ users }: { users: AdminUser[] }) {
  const { t, locale } = useOwnerI18n();
  const columns = t.users.columns;

  return (
    <table className="data-table">
      <caption className="sr-only">{t.users.listLabel}</caption>
      <thead>
        <tr>
          <th scope="col">{columns.account}</th>
          <th scope="col">{columns.role}</th>
          <th scope="col">{columns.status}</th>
          <th scope="col">{columns.authenticator}</th>
          <th scope="col">{columns.lastLogin}</th>
          {/* The arrow column is decoration: the name link is the row's one target. */}
          <td aria-hidden className="w-12" />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} data-row className="group">
            <td className="max-w-[22rem]">
              <NameCell user={user} />
            </td>
            <td className="font-medium">{t.roles[user.role]}</td>
            <td>
              <StatusCapsule
                status={accountTone[user.status]}
                label={t.accountStatus[user.status]}
              />
            </td>
            <td className="text-ink-muted">
              {user.two_factor_confirmed ? t.users.authenticatorOn : t.users.authenticatorOff}
            </td>
            <td className="text-ink-muted tabular-nums">{lastLogin(user, t, locale)}</td>
            <td className="w-12 text-right">
              <span
                aria-hidden
                className="inline-flex size-8 items-center justify-center rounded-full border border-line-strong text-ink transition-[transform,background-color,color,border-color] duration-[var(--dur-state)] group-hover:translate-x-0.5 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink"
              >
                <ArrowRight size={14} weight="bold" />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Below 768px every row is a card in one list (docs/architecture/admin-dashboard.md 7). */
function UserCards({ users }: { users: AdminUser[] }) {
  const { t, locale } = useOwnerI18n();

  return (
    <ul aria-label={t.users.listLabel} className="grid gap-3">
      {users.map((user) => (
        <li
          key={user.id}
          data-row
          className="relative rounded-[1.25rem] border border-line bg-paper-raised px-5 py-4"
        >
          <NameCell user={user} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusCapsule status={accountTone[user.status]} label={t.accountStatus[user.status]} />
            <span className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-meta font-medium">
              {t.roles[user.role]}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-meta">
            <dt className="text-ink-muted">{t.users.columns.authenticator}</dt>
            <dd>
              {user.two_factor_confirmed ? t.users.authenticatorOn : t.users.authenticatorOff}
            </dd>
            <dt className="text-ink-muted">{t.users.columns.lastLogin}</dt>
            <dd className="tabular-nums">{lastLogin(user, t, locale)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
