"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFilterQuery } from "./use-filter-query";

export function CatalogSearch({ className }: { className?: string }) {
  const { setSingle, searchParams } = useFilterQuery();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = React.useState(urlQuery);
  // Last query we wrote to the URL ourselves, and whether that write is still
  // in flight. While it is, the URL keeps echoing the *previous* query back at
  // us; syncing that into the input would wipe out characters typed in the
  // meantime.
  const committedRef = React.useRef(urlQuery);
  const pendingRef = React.useRef(false);

  // URL -> input, but only for changes we didn't cause (browser nav, links).
  React.useEffect(() => {
    if (urlQuery === committedRef.current) {
      pendingRef.current = false; // our own write landed
      return;
    }
    if (pendingRef.current) return; // stale echo, ignore
    committedRef.current = urlQuery;
    setValue(urlQuery);
  }, [urlQuery]);

  // input -> URL, debounced. Compare against the committed query so an
  // unchanged value (e.g. on mount, or a trailing space) doesn't navigate.
  React.useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === committedRef.current) return;
    const id = setTimeout(() => {
      committedRef.current = trimmed;
      pendingRef.current = true;
      setSingle("q", trimmed || undefined);
    }, 350);
    return () => clearTimeout(id);
  }, [value, setSingle]);

  return (
    <div className={cn("relative", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Үнэртэн, брэнд хайх…"
        aria-label="Хайх"
        className="px-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Цэвэрлэх"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
