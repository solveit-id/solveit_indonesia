import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useVerifiedAccount } from "~/auth/use-account";
import {
  InquiryForbidden,
  InquiryStatusCapsule,
  PrivacyFoot,
  inquiryListErrorCopy,
} from "~/components/inquiry/inquiry-ui";
import {
  ListFooter,
  PageHeader,
  hasPermission,
  isForbidden,
  useFocusAppended,
  useRowEntrance,
} from "~/components/admin/owner-ui";
import { useCursorList } from "~/components/admin/use-cursor-list";
import { Button } from "~/components/ui/button";
import { SelectField } from "~/components/ui/select-field";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { TextField } from "~/components/ui/text-field";
import { useInquiryI18n } from "~/i18n/inquiry";
import { cn } from "~/lib/cn";
import { dayBoundary, isCalendarDay } from "~/lib/local-day";
import { TABLE_QUERY, useMediaQuery } from "~/lib/media";
import { formatDateTime } from "~/lib/time";
import { inquiryPath } from "~/routes/paths";
import {
  type AdminInquiry,
  type AdminInquiryFilters,
  INQUIRY_REFERENCE,
  type InquiryService,
  type InquiryStatus,
  inquiryApi,
  inquiryServices,
  inquiryStatuses,
} from "~/services/admin-api/inquiry";

const listInquiries = inquiryApi.listInquiries;

/** Address keys of the filters (`/inquiry?status=received&layanan=website&referensi=...`). */
const keys = {
  status: "status",
  service: "layanan",
  from: "dari",
  to: "sampai",
  reference: "referensi",
} as const;

type FilterKey = (typeof keys)[keyof typeof keys];

interface ReadFilters {
  /** Sent to Laravel; never holds a value Laravel would refuse. */
  api: AdminInquiryFilters;
  from: string;
  to: string;
  rangeInvalid: boolean;
  /** The reference as written in the address, valid or not (shown in its field). */
  reference: string;
  referenceInvalid: boolean;
  any: boolean;
}

/**
 * Filters from the address. Unknown or malformed values are ignored, never sent: Laravel
 * refuses them with 422, and a guessed correction could show the wrong inquiries. Only the
 * public reference and the filter choices go into the address; never a name or a contact.
 */
function readFilters(params: URLSearchParams): ReadFilters {
  const status = params.get(keys.status);
  const service = params.get(keys.service);
  const from = isCalendarDay(params.get(keys.from)) ? params.get(keys.from)! : "";
  const to = isCalendarDay(params.get(keys.to)) ? params.get(keys.to)! : "";
  const rangeInvalid = from !== "" && to !== "" && to < from;
  const reference = params.get(keys.reference) ?? "";
  const referenceValid = INQUIRY_REFERENCE.test(reference);

  const api: AdminInquiryFilters = {
    status: (inquiryStatuses as readonly string[]).includes(status ?? "")
      ? (status as InquiryStatus)
      : undefined,
    service: (inquiryServices as readonly string[]).includes(service ?? "")
      ? (service as InquiryService)
      : undefined,
    received_from: from && !rangeInvalid ? dayBoundary(from, "start") : undefined,
    received_to: to && !rangeInvalid ? dayBoundary(to, "end") : undefined,
    reference: referenceValid ? reference : undefined,
  };

  return {
    api,
    from,
    to,
    rangeInvalid,
    reference,
    referenceInvalid: reference !== "" && !referenceValid,
    any:
      Object.values(api).some((value) => value !== undefined) || rangeInvalid || reference !== "",
  };
}

/**
 * Inquiries (B4b, `GET inquiries`, owner and admin by `inquiries.view`): newest first, filtered
 * by the indexed fields Laravel allows (status, service, received dates, exact reference),
 * older pages loaded on request. The list shows who sent it and its state, never the contact
 * (masked or not) or the message: those are on the detail. Nothing here changes an inquiry.
 */
export function Inquiries() {
  const { t } = useInquiryI18n();
  const account = useVerifiedAccount();
  const allowed = hasPermission(account, "inquiries.view");

  return (
    <article>
      <PageHeader title={t.list.title} lede={t.list.lede} />
      <div className="mt-10">{allowed ? <InquiryList /> : <InquiryForbidden />}</div>
    </article>
  );
}

function InquiryList() {
  const { t } = useInquiryI18n();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const { state, loadMore, moreBusy, moreError, reload } = useCursorList(
    listInquiries,
    filters.api,
  );
  const wide = useMediaQuery(TABLE_QUERY);
  const rows = useRef<HTMLDivElement>(null);
  const copy = t.list;

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
    return <InquiryForbidden />;
  }

  return (
    <section aria-label={copy.listLabel}>
      <div
        role="group"
        aria-labelledby="inquiry-filters-title"
        className="rounded-panel border border-line bg-paper-raised p-5 sm:p-6"
      >
        <h2 id="inquiry-filters-title" className="text-item font-semibold font-wide">
          {copy.filtersTitle}
        </h2>
        <div className="mt-4 grid items-start gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label={copy.status}
            value={filters.api.status ?? ""}
            onChange={(event) => setFilter(keys.status, event.target.value)}
          >
            <option value="">{copy.allStatuses}</option>
            {inquiryStatuses.map((status) => (
              <option key={status} value={status}>
                {t.status[status]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={copy.service}
            value={filters.api.service ?? ""}
            onChange={(event) => setFilter(keys.service, event.target.value)}
          >
            <option value="">{copy.allServices}</option>
            {inquiryServices.map((service) => (
              <option key={service} value={service}>
                {t.service[service]}
              </option>
            ))}
          </SelectField>
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
        {/* Keyed by the address value: clearing the filters empties the field as well. */}
        <ReferenceSearch
          key={filters.reference}
          value={filters.reference}
          invalid={filters.referenceInvalid}
          onSearch={(value) => setFilter(keys.reference, value)}
        />
        {filters.any ? (
          <Button variant="quiet" className="mt-4 -ml-3" onClick={clearFilters}>
            {t.inquiry.clearFilters}
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        {state.status === "loading" ? <LoadingState label={copy.loading} rows={4} /> : null}

        {state.status === "failed" ? (
          <ErrorState title={copy.loadFailed} retryLabel={t.common.retry} onRetry={reload}>
            {inquiryListErrorCopy(state.error, t)}
          </ErrorState>
        ) : null}

        {ready && ready.items.length === 0 ? (
          filters.any ? (
            <EmptyState
              title={copy.emptyFiltered}
              action={<Button onClick={clearFilters}>{t.inquiry.clearFilters}</Button>}
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
              className={cn(ready.refreshing && "list-stale")}
            >
              {wide ? (
                <InquiryTable inquiries={ready.items} />
              ) : (
                <InquiryCards inquiries={ready.items} />
              )}
            </div>
            <ListFooter
              summary={
                ready.refreshing
                  ? t.inquiry.refreshing
                  : copy.showing(ready.items.length, ready.hasMore)
              }
              hasMore={ready.hasMore && !ready.refreshing}
              busy={moreBusy}
              error={moreError}
              loadLabel={copy.loadMore}
              onLoadMore={() => void loadMore()}
            />
          </>
        ) : null}
      </div>

      <PrivacyFoot />
    </section>
  );
}

/**
 * The exact-reference search: typed freely, sent only on Find and only in Laravel's format
 * (upper case is applied; nothing else is guessed). An empty search removes the filter.
 */
function ReferenceSearch({
  value,
  invalid,
  onSearch,
}: {
  value: string;
  invalid: boolean;
  onSearch: (value: string) => void;
}) {
  const { t } = useInquiryI18n();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | undefined>(
    invalid ? t.list.referenceInvalid : undefined,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = draft.trim().toUpperCase();

    if (normalized !== "" && !INQUIRY_REFERENCE.test(normalized)) {
      setError(t.list.referenceInvalid);

      return;
    }

    setError(undefined);
    onSearch(normalized);
  };

  return (
    <form
      noValidate
      role="search"
      onSubmit={submit}
      className="mt-4 grid items-start gap-3 sm:grid-cols-[minmax(0,26rem)_auto] sm:justify-start"
    >
      <TextField
        label={t.list.reference}
        hint={t.list.referenceHint}
        error={error}
        value={draft}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
        className="min-w-0"
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        className="sm:mt-[1.85rem]"
        icon={<MagnifyingGlass aria-hidden size={18} weight="bold" />}
      >
        {t.list.find}
      </Button>
    </form>
  );
}

function received(inquiry: AdminInquiry, locale: "id" | "en", fallback: string) {
  return formatDateTime(inquiry.received_at, locale) ?? fallback;
}

function SenderCell({ inquiry }: { inquiry: AdminInquiry }) {
  return (
    <div className="min-w-0">
      <Link
        to={inquiryPath(inquiry.id)}
        className="row-link font-semibold [overflow-wrap:anywhere] text-ink"
      >
        {inquiry.name}
      </Link>
      {inquiry.organization ? (
        <p className="mt-0.5 text-meta [overflow-wrap:anywhere] text-ink-muted">
          {inquiry.organization}
        </p>
      ) : null}
    </div>
  );
}

function InquiryTable({ inquiries }: { inquiries: AdminInquiry[] }) {
  const { t, locale } = useInquiryI18n();
  const columns = t.list.columns;

  return (
    <table className="data-table">
      <caption className="sr-only">{t.list.listLabel}</caption>
      <thead>
        <tr>
          <th scope="col">{columns.sender}</th>
          <th scope="col">{columns.reference}</th>
          <th scope="col">{columns.service}</th>
          <th scope="col">{columns.status}</th>
          <th scope="col">{columns.received}</th>
          {/* The arrow column is decoration: the sender link is the row's one target. */}
          <td aria-hidden className="w-12" />
        </tr>
      </thead>
      <tbody>
        {inquiries.map((inquiry) => (
          <tr key={inquiry.id} data-row className="group">
            <td className="max-w-[20rem]">
              <SenderCell inquiry={inquiry} />
            </td>
            <td className="font-mono text-meta whitespace-nowrap">{inquiry.reference}</td>
            <td>{t.service[inquiry.service] ?? inquiry.service}</td>
            <td>
              <InquiryStatusCapsule status={inquiry.status} />
            </td>
            <td className="text-ink-muted tabular-nums">
              {received(inquiry, locale, t.common.notRecorded)}
            </td>
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
function InquiryCards({ inquiries }: { inquiries: AdminInquiry[] }) {
  const { t, locale } = useInquiryI18n();

  return (
    <ul aria-label={t.list.listLabel} className="grid gap-3">
      {inquiries.map((inquiry) => (
        <li
          key={inquiry.id}
          data-row
          className="relative rounded-[1.25rem] border border-line bg-paper-raised px-5 py-4"
        >
          <SenderCell inquiry={inquiry} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <InquiryStatusCapsule status={inquiry.status} />
            <span className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 text-meta font-medium">
              {t.service[inquiry.service] ?? inquiry.service}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-meta">
            <dt className="text-ink-muted">{t.list.columns.reference}</dt>
            <dd className="font-mono break-all">{inquiry.reference}</dd>
            <dt className="text-ink-muted">{t.list.columns.received}</dt>
            <dd className="tabular-nums">{received(inquiry, locale, t.common.notRecorded)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
