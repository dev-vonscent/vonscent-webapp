"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Helpers to read/update multi-value catalog filter params in the URL. */
export function useFilterQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useCallback(
    (key: string): string[] => {
      const raw = searchParams.get(key);
      return raw ? raw.split(",").filter(Boolean) : [];
    },
    [searchParams],
  );

  const commit = useCallback(
    (next: URLSearchParams) => {
      next.delete("page"); // reset pagination on any filter change
      const qs = next.toString();
      // replace (not push) so filter tweaks don't stack history entries and
      // trap the back button on the catalog page.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
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

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const activeCount = [
    "brand",
    "gender",
    "family",
    "season",
    "tags",
    "minPrice",
    "maxPrice",
    "q",
  ].reduce((n, k) => n + (searchParams.get(k) ? 1 : 0), 0);

  return {
    values,
    toggle,
    setSingle,
    setMany,
    clearAll,
    activeCount,
    searchParams,
  };
}
