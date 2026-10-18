import { useCallback, useEffect, useRef, useState } from "react";
import type { CursorPage, PageRequest } from "~/services/admin-api/owner";
import { isAdminApiError } from "~/services/admin-api";

type FetchPage<T, F> = (filters: F, page: PageRequest) => Promise<CursorPage<T>>;

interface Loaded<T> {
  /** The filters (and reload count) these rows belong to. */
  key: string;
  items: T[];
  nextCursor: string | null;
  /** Index of the first row added by the latest "load more", or null after a fresh load. */
  appendedFrom: number | null;
}

export type CursorListState<T> =
  | { status: "loading" }
  | { status: "failed"; error: unknown }
  | {
      status: "ready";
      items: T[];
      hasMore: boolean;
      /** The rows on screen belong to the previous filters while the new ones load. */
      refreshing: boolean;
      appendedFrom: number | null;
      /** Changes with every new set of rows (fresh load or append): drives the entrance. */
      revision: string;
    };

/**
 * One owner list over Laravel's cursor pagination (docs/api/admin-users.md, Daftar dan
 * pagination), with the load-more model (owner decision 2026-10-18).
 *
 * - `filters` must be a plain object; a change of its JSON loads the first page again. The rows
 *   already on screen stay (quieter) until the new ones arrive, so nothing jumps.
 * - `loadMore` appends `meta.next_cursor`'s page, passed back exactly as Laravel sent it.
 * - Reads are always safe to repeat, so `reload` and the retry are plain reads.
 * - A 401 shows nothing here: the session store sends the person to sign-in.
 * - A request for filters that are no longer current is aborted and its answer ignored.
 */
export function useCursorList<T extends { id: number }, F extends object>(
  fetchPage: FetchPage<T, F>,
  filters: F,
) {
  const filtersKey = JSON.stringify(filters);
  const [version, setVersion] = useState(0);
  const requestKey = `${filtersKey}#${version}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const moreController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    moreController.current?.abort();

    fetchPage(JSON.parse(filtersKey) as F, { signal: controller.signal }).then(
      (page) => {
        setLoaded({
          key: requestKey,
          items: page.data,
          nextCursor: page.meta.next_cursor,
          appendedFrom: null,
        });
        setFailure(null);
        setMoreError(null);
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (isAdminApiError(error) && error.kind === "unauthenticated") {
          return;
        }

        setFailure({ key: requestKey, error });
      },
    );

    return () => controller.abort();
  }, [fetchPage, filtersKey, requestKey]);

  const loadMore = useCallback(async () => {
    if (loaded === null || loaded.nextCursor === null || moreController.current !== null) {
      return;
    }

    const controller = new AbortController();
    moreController.current = controller;
    const forKey = loaded.key;
    setMoreBusy(true);
    setMoreError(null);

    try {
      const page = await fetchPage(JSON.parse(filtersKey) as F, {
        cursor: loaded.nextCursor,
        signal: controller.signal,
      });

      setLoaded((previous) => {
        if (previous === null || previous.key !== forKey) {
          return previous;
        }

        const seen = new Set(previous.items.map((item) => item.id));

        return {
          key: previous.key,
          items: [...previous.items, ...page.data.filter((item) => !seen.has(item.id))],
          nextCursor: page.meta.next_cursor,
          appendedFrom: previous.items.length,
        };
      });
    } catch (error) {
      if (
        !controller.signal.aborted &&
        !(isAdminApiError(error) && error.kind === "unauthenticated")
      ) {
        setMoreError(error);
      }
    } finally {
      if (moreController.current === controller) {
        moreController.current = null;
      }

      setMoreBusy(false);
    }
  }, [fetchPage, filtersKey, loaded]);

  /** Read the first page again with the same filters (after a change, or on request). */
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  /** Replace rows locally with what Laravel returned after a write (no extra read). */
  const update = useCallback((replace: (item: T) => T) => {
    setLoaded((previous) =>
      previous === null ? previous : { ...previous, items: previous.items.map(replace) },
    );
  }, []);

  let state: CursorListState<T>;

  if (failure !== null && failure.key === requestKey) {
    state = { status: "failed", error: failure.error };
  } else if (loaded === null) {
    state = { status: "loading" };
  } else {
    state = {
      status: "ready",
      items: loaded.items,
      hasMore: loaded.nextCursor !== null,
      refreshing: loaded.key !== requestKey,
      appendedFrom: loaded.appendedFrom,
      revision: `${loaded.key}:${loaded.items.length}`,
    };
  }

  return { state, loadMore, moreBusy, moreError, reload, update };
}
