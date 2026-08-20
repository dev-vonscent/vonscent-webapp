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

  // Keep the input in sync when the URL query changes (e.g. browser nav).
  React.useEffect(() => setValue(urlQuery), [urlQuery]);

  // Debounce updates to the URL; skip when nothing actually changed so we
  // don't reset pagination on mount.
  React.useEffect(() => {
    if (value === urlQuery) return;
    const id = setTimeout(() => setSingle("q", value.trim() || undefined), 350);
    return () => clearTimeout(id);
  }, [value, urlQuery, setSingle]);

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
