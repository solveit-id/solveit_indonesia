import { useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { useVerifiedAccount } from "~/auth/use-account";
import {
  AuditEventItem,
  auditActionGroups,
  auditActionLabel,
  isAuditAction,
} from "~/components/admin/audit-event";
import { type AccountDirectory, useAccountDirectory } from "~/components/admin/directory";
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
import { useCursorList } from "~/components/admin/use-cursor-list";
import { Button } from "~/components/ui/button";
import { SelectField } from "~/components/ui/select-field";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { PhaseGlyph } from "~/components/ui/status-capsule";
import { TextField } from "~/components/ui/text-field";
import { useOwnerI18n } from "~/i18n/owner";
import type { OwnerCopy } from "~/i18n/owner";
import { cn } from "~/lib/cn";
import { dayBoundary, isCalendarDay, localDayKey } from "~/lib/local-day";
import {
  type AdminActorType,
  type AdminAuditEvent,
  type AdminAuditFilters,
  adminActorTypes,
  administrationApi,
} from "~/services/admin-api/owner";

const listAuditEvents = administrationApi.listAuditEvents;

/** Address keys of the filters (`/audit?tindakan=...&subjek=7`, `/audit?inquiry=42`). */
const keys = {
  action: "tindakan",
  actorType: "jenis",
  actor: "pelaku",
  subject: "subjek",
  inquiry: "inquiry",
  from: "dari",
  to: "sampai",
} as const;

type FilterKey = (typeof keys)[keyof typeof keys];

const accountId = (value: string | null): number | undefined =>
  /^[1-9][0-9]{0,9}$/.test(value ?? "") ? Number(value) : undefined;

interface ReadFilters {
  /** Sent to Laravel; never holds a value Laravel would refuse. */
  api: AdminAuditFilters;
  from: string;
  to: string;
  rangeInvalid: boolean;
  any: boolean;
}

/**
 * Filters from the address. Unknown or malformed values are ignored, never sent. An inquiry
 * subject (from an inquiry's detail) replaces the account subject: Laravel refuses both at once.
 */
function readFilters(params: URLSearchParams): ReadFilters {
  const action = params.get(keys.action);
  const actorType = params.get(keys.actorType);
  const from = isCalendarDay(params.get(keys.from)) ? params.get(keys.from)! : "";
  const to = isCalendarDay(params.get(keys.to)) ? params.get(keys.to)! : "";
  const inquiry = accountId(params.get(keys.inquiry));
  const rangeInvalid = from !== "" && to !== "" && to < from;

  const api: AdminAuditFilters = {
    action: isAuditAction(action) ? action : undefined,
    actor_type: (adminActorTypes as readonly string[]).includes(actorType ?? "")
      ? (actorType as AdminActorType)
      : undefined,
    actor_user_id: accountId(params.get(keys.actor)),
    subject_user_id: inquiry === undefined ? accountId(params.get(keys.subject)) : undefined,
    subject_inquiry_id: inquiry,
    occurred_from: from && !rangeInvalid ? dayBoundary(from, "start") : undefined,
    occurred_to: to && !rangeInvalid ? dayBoundary(to, "end") : undefined,
  };

  return {
    api,
    from,
    to,
    rangeInvalid,
    any: Object.values(api).some((value) => value !== undefined) || rangeInvalid,
  };
}

/**
 * Audit log (B3.2c, `GET audit-events`, owner only, read only): events newest first on one
 * spine, grouped by the reader's calendar day, filtered only by the allowlisted fields Laravel
 * indexes. Older events load on request. Nothing here can change, delete, or export an event.
 */
export function Audit() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const allowed = hasPermission(account, "audit.view-all");

  return (
    <article>
      <PageHeader title={t.audit.title} lede={t.audit.lede} />
      <div className="mt-10">{allowed ? <AuditLog /> : <ForbiddenState />}</div>
    </article>
  );
}

function AuditLog() {
  const { t } = useOwnerI18n();
  const account = useVerifiedAccount();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const { state, loadMore, moreBusy, moreError, reload } = useCursorList(
    listAuditEvents,
    filters.api,
  );
  const directory = useAccountDirectory();
  const rows = useRef<HTMLDivElement>(null);
  const copy = t.audit;

  const ready = state.status === "ready" ? state : null;
  useRowEntrance(rows, ready?.revision ?? null, ready?.appendedFrom ?? 0);
  useFocusAppended(rows, ready?.appendedFrom ?? null);

  const setFilter = (key: FilterKey, value: string) =>
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

  const clearFilters = () => setParams({}, { replace: true, preventScrollReset: true });

  if (state.status === "failed" && isForbidden(state.error)) {
    return <ForbiddenState />;
  }

  return (
    <section aria-label={copy.title}>
      <div
        role="group"
        aria-labelledby="audit-filters-title"
        className="rounded-panel border border-line bg-paper-raised p-5 sm:p-6"
      >
        <h2 id="audit-filters-title" className="text-item font-semibold font-wide">
          {copy.filtersTitle}
        </h2>
        <div className="mt-4 grid items-start gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label={copy.action}
            value={filters.api.action ?? ""}
            onChange={(event) => setFilter(keys.action, event.target.value)}
          >
            <option value="">{copy.allActions}</option>
            {auditActionGroups.map((group) => (
              <optgroup key={group.key} label={copy.groups[group.key]}>
                {group.actions.map((action) => (
                  <option key={action} value={action}>
                    {auditActionLabel(action, t)}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <SelectField
            label={copy.actorType}
            value={filters.api.actor_type ?? ""}
            onChange={(event) => setFilter(keys.actorType, event.target.value)}
          >
            <option value="">{copy.allActorTypes}</option>
            {adminActorTypes.map((type) => (
              <option key={type} value={type}>
                {copy.actorTypes[type]}
              </option>
            ))}
          </SelectField>
          <AccountSelect
            label={copy.actor}
            value={filters.api.actor_user_id}
            directory={directory}
            currentId={account.id}
            onChange={(value) => setFilter(keys.actor, value)}
          />
          {filters.api.subject_inquiry_id === undefined ? (
            <AccountSelect
              label={copy.subject}
              value={filters.api.subject_user_id}
              directory={directory}
              currentId={account.id}
              onChange={(value) => setFilter(keys.subject, value)}
            />
          ) : (
            <div className="grid content-start gap-2">
              <p className="text-[0.9375rem] font-semibold">{copy.on}</p>
              <p className="min-h-11 text-[0.9375rem] text-ink-muted">
                {copy.inquiryOnly(t.owner.inquiryNumber(filters.api.subject_inquiry_id))}{" "}
                <button
                  type="button"
                  className="font-semibold text-accent-text underline underline-offset-4"
                  onClick={() => setFilter(keys.inquiry, "")}
                >
                  {copy.allSubjects}
                </button>
              </p>
            </div>
          )}
          <TextField
            label={copy.from}
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilter(keys.from, event.target.value)}
          />
          <TextField
            label={copy.to}
            type="date"
            hint={copy.dateHint}
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilter(keys.to, event.target.value)}
            error={filters.rangeInvalid ? copy.rangeInvalid : undefined}
          />
        </div>
        {filters.any ? (
          <Button variant="quiet" className="mt-4 -ml-3" onClick={clearFilters}>
            {t.owner.clearFilters}
          </Button>
        ) : null}
      </div>

      <Legend t={t} />

      <div className="mt-6">
        {state.status === "loading" ? <LoadingState label={copy.loading} rows={4} /> : null}

        {state.status === "failed" ? (
          <ErrorState title={copy.loadFailed} retryLabel={t.common.retry} onRetry={reload}>
            {listErrorCopy(state.error, t)}
          </ErrorState>
        ) : null}

        {ready && ready.items.length === 0 ? (
          filters.any ? (
            <EmptyState
              title={copy.emptyFiltered}
              action={<Button onClick={clearFilters}>{t.owner.clearFilters}</Button>}
            >
              {copy.emptyFilteredBody}
            </EmptyState>
          ) : (
            <EmptyState title={copy.empty}>{copy.emptyBody}</EmptyState>
          )
        ) : null}

        {ready && ready.items.length > 0 ? (
          <>
            <div
              ref={rows}
              aria-busy={ready.refreshing || undefined}
              className={cn("grid gap-8", ready.refreshing && "list-stale")}
            >
              <Timeline events={ready.items} directory={directory} currentId={account.id} />
            </div>
            <ListFooter
              summary={
                ready.refreshing
                  ? t.owner.refreshing
                  : copy.showing(ready.items.length, ready.hasMore)
              }
              hasMore={ready.hasMore && !ready.refreshing}
              busy={moreBusy}
              error={moreError}
              loadLabel={copy.loadOlder}
              onLoadMore={() => void loadMore()}
            />
          </>
        ) : null}
      </div>

      <p className="mt-12 max-w-[64ch] border-t border-line pt-5 text-meta text-ink-muted">
        {copy.retention}
      </p>
    </section>
  );
}

function AccountSelect({
  label,
  value,
  directory,
  currentId,
  onChange,
}: {
  label: string;
  value: number | undefined;
  directory: AccountDirectory | null;
  currentId: number;
  onChange: (value: string) => void;
}) {
  const { t } = useOwnerI18n();
  const accounts = [...(directory?.values() ?? [])];
  // An ID from the address that the directory does not hold still shows as itself.
  const missing = value !== undefined && !accounts.some((entry) => entry.id === value);

  return (
    <SelectField
      label={label}
      value={value === undefined ? "" : String(value)}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t.audit.anyAccount}</option>
      {missing ? <option value={value}>{t.owner.accountNumber(value)}</option> : null}
      {accounts.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.id === currentId ? `${entry.name} (${t.owner.you})` : entry.name}
        </option>
      ))}
    </SelectField>
  );
}

function Legend({ t }: { t: OwnerCopy }) {
  const items = [
    ["released", t.audit.legend.administration],
    ["stopped", t.audit.legend.failure],
    ["outline", t.audit.legend.routine],
  ] as const;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-meta text-ink-muted">
      <span className="sr-only">{t.audit.legendLabel}</span>
      {items.map(([tone, label]) => (
        <span key={tone} className="inline-flex items-center gap-2">
          <PhaseGlyph status={tone} className="scale-75" />
          {label}
        </span>
      ))}
    </div>
  );
}

/** Events grouped by the reader's calendar day, each day on its own stretch of the spine. */
function Timeline({
  events,
  directory,
  currentId,
}: {
  events: AdminAuditEvent[];
  directory: AccountDirectory | null;
  currentId: number;
}) {
  const { locale } = useOwnerI18n();
  const days = new Map<string, AdminAuditEvent[]>();

  for (const event of events) {
    const key = localDayKey(event.occurred_at);
    days.set(key, [...(days.get(key) ?? []), event]);
  }

  const dayTitle = (iso: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { dateStyle: "full" }).format(
      new Date(iso),
    );

  return (
    <>
      {[...days.entries()].map(([key, dayEvents]) => (
        <section key={key} aria-labelledby={`day-${key}`}>
          <h2
            id={`day-${key}`}
            className="sticky top-16 z-[2] -mx-1 bg-paper/95 px-1 py-2 text-item font-semibold font-wide lg:top-0"
          >
            {key === "unknown" ? key : dayTitle(dayEvents[0]!.occurred_at)}
          </h2>
          <ol className="relative mt-3">
            <span aria-hidden className="timeline-spine" />
            {dayEvents.map((event) => (
              <AuditEventItem
                key={event.id}
                event={event}
                directory={directory}
                currentId={currentId}
              />
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
