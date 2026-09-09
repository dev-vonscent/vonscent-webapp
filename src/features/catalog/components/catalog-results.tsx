"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useFilterQuery } from "./use-filter-query";

/**
 * Wraps the product grid so it reads as "catching up" while a filter change is
 * still in flight. The chips flip instantly (optimistic query string), which
 * without this would leave the list looking authoritative and wrong for as long
 * as the server render takes.
 */
export function CatalogResults({ children }: { children: React.ReactNode }) {
  const { isPending } = useFilterQuery();
  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-50",
      )}
    >
      {children}
    </div>
  );
}
