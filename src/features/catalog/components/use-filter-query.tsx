"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Params that count as an active filter for the "Цэвэрлэх (n)" badge. */
const FILTER_KEYS = [
  "brand",
  "gender",
  "family",
  "season",
  "tags",
  "featured",
  "minPrice",
  "maxPrice",
  "q",
];

/** Helpers to read/update multi-value catalog filter params in the URL. */
function useFilterQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();

  /**
   * Filtering is a server round trip. Reading selection straight off
   * `useSearchParams()` meant a chip only lit up once the RSC render came
   * back — imperceptible locally, a second or more against a remote database,
   * so a tap looked ignored and people tapped again.
   *
   * The optimistic query string flips the UI on click and React drops it when
   * the navigation transition settles, leaving the URL the single source of
   * truth. `isPending` is exposed so callers can show the list catching up.
   */
  const [isPending, startTransition] = useTransition();
  const [queryString, setQueryString] = useOptimistic(urlParams.toString());
  const searchParams = useMemo(
    () => new URLSearchParams(queryString),
    [queryString],
  );

  const values = useCallback(
    (key: string): string[] => {
      const raw = searchParams.get(key);
      return raw ? raw.split(",").filter(Boolean) : [];
    },
    [searchParams],
  );

  const navigate = useCallback(
    (qs: string, scroll = false) => {
      startTransition(() => {
        setQueryString(qs);
        // replace (not push) so filter tweaks don't stack history entries and
        // trap the back button on the catalog page.
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll });
      });
    },
    [pathname, router, setQueryString],
  );

  const commit = useCallback(
    (next: URLSearchParams) => {
      next.delete("page"); // reset pagination on any filter change
      navigate(next.toString());
    },
    [navigate],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const current = values(key);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (updated.length) next.set(key, updated.join(","));
      else next.delete(key);
      commit(next);
    },
    [searchParams, values, commit],
  );

  const setSingle = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      commit(next);
    },
    [searchParams, commit],
  );

  /** Set/clear several params in a single navigation. */
  const setMany = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      commit(next);
    },
    [searchParams, commit],
  );

  /**
   * Paging is the one navigation that must keep `page` (commit strips it) and
   * the one that should scroll back to the top of the list.
   */
  const setPage = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams.toString());
      if (page > 1) next.set("page", String(page));
      else next.delete("page");
      navigate(next.toString(), true);
    },
    [searchParams, navigate],
  );

  const clearAll = useCallback(() => navigate(""), [navigate]);

  const activeCount = FILTER_KEYS.reduce(
    (n, k) => n + (searchParams.get(k) ? 1 : 0),
    0,
  );

  return {
    values,
    toggle,
    setSingle,
    setMany,
    setPage,
    clearAll,
    activeCount,
    searchParams,
    isPending,
  };
}

export type FilterQuery = ReturnType<typeof useFilterQueryState>;

const FilterQueryContext = createContext<FilterQuery | null>(null);

/**
 * One shared filter state for the whole catalog page.
 *
 * The sidebar, the mobile sheet, the sort select and the search box all write
 * to the same query string, so they have to share one optimistic copy of it —
 * with a hook instance each, a chip ticked in the sidebar stayed invisible to
 * the sheet until the navigation landed.
 */
export function FilterQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useFilterQueryState();
  return (
    <FilterQueryContext.Provider value={value}>
      {children}
    </FilterQueryContext.Provider>
  );
}

export function useFilterQuery(): FilterQuery {
  const ctx = useContext(FilterQueryContext);
  if (!ctx) {
    throw new Error("useFilterQuery must be used inside <FilterQueryProvider>");
  }
  return ctx;
}
