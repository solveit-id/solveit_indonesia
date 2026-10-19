import { useRef } from "react";
import { ListFooter, useFocusAppended, useRowEntrance } from "~/components/admin/owner-ui";
import { useCursorList } from "~/components/admin/use-cursor-list";
import { EmptyState, ErrorState, LoadingState } from "~/components/ui/state-view";
import { PhaseGlyph } from "~/components/ui/status-capsule";
import { useInquiryI18n } from "~/i18n/inquiry";
import { formatDateTime } from "~/lib/time";
import { type PageRequest, inquiryApi } from "~/services/admin-api/inquiry";
import { actorLabel, inquiryListErrorCopy, inquiryTone, statusLabel } from "./inquiry-ui";

/** `version` is part of the key: a confirmed change on the detail reads the history again. */
interface HistoryKey {
  id: number;
  version: number;
}

const listStatusChanges = (key: HistoryKey, page: PageRequest) =>
  inquiryApi.listStatusChanges(key.id, page);

/**
 * The status history of one inquiry (`GET inquiries/{id}/status-changes`), newest first on the
 * console's spine: each move in words, who made it, and when. Read only; Laravel refuses any
 * change to these rows, and so does MySQL.
 */
export function StatusHistory({
  inquiryId,
  version,
  currentId,
}: {
  inquiryId: number;
  version: number;
  currentId: number;
}) {
  const { t, locale } = useInquiryI18n();
  const { state, loadMore, moreBusy, moreError, reload } = useCursorList(listStatusChanges, {
    id: inquiryId,
    version,
  });
  const rows = useRef<HTMLOListElement>(null);
  const copy = t.history;

  const ready = state.status === "ready" ? state : null;
  useRowEntrance(rows, ready?.revision ?? null, ready?.appendedFrom ?? 0);
  useFocusAppended(rows, ready?.appendedFrom ?? null);

  return (
    <section
      aria-labelledby="history-title"
      className="rounded-panel border border-line bg-paper-raised p-6 sm:p-7"
    >
      <h2 id="history-title" className="text-section font-wide">
        {copy.title}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">{copy.body}</p>
      <div className="mt-5">
        {state.status === "loading" ? <LoadingState label={copy.loading} rows={3} /> : null}
        {state.status === "failed" ? (
          <ErrorState title={copy.loadFailed} retryLabel={t.common.retry} onRetry={reload}>
            {inquiryListErrorCopy(state.error, t)}
          </ErrorState>
        ) : null}
        {ready && ready.items.length === 0 ? (
          <EmptyState title={copy.empty}>{copy.emptyBody}</EmptyState>
        ) : null}
        {ready && ready.items.length > 0 ? (
          <>
            <ol ref={rows} className="relative">
              <span aria-hidden className="timeline-spine" />
              {ready.items.map((change) => (
                <li
                  key={change.id}
                  data-row
                  className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 pb-6 last:pb-1"
                >
                  <span className="relative z-[1] flex size-7 items-center justify-center rounded-full bg-paper-raised">
                    <PhaseGlyph
                      status={inquiryTone[change.to_status] ?? "outline"}
                      className="scale-[0.8]"
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <h3 className="text-item font-semibold text-ink">
                        {copy.move(
                          statusLabel(change.from_status, t),
                          statusLabel(change.to_status, t),
                        )}
                      </h3>
                      {change.changed_at ? (
                        <time
                          dateTime={change.changed_at}
                          className="text-meta text-ink-muted tabular-nums"
                        >
                          {formatDateTime(change.changed_at, locale) ?? change.changed_at}
                        </time>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[0.9375rem]">
                      <span className="text-ink-muted">{copy.by}</span>{" "}
                      <span className="font-medium text-ink">
                        {actorLabel(change.changed_by, currentId, t)}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <ListFooter
              summary={copy.showing(ready.items.length, ready.hasMore)}
              hasMore={ready.hasMore && !ready.refreshing}
              busy={moreBusy}
              error={moreError}
              loadLabel={copy.loadMore}
              onLoadMore={() => void loadMore()}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
