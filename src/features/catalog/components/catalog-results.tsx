"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useFilterQuery } from "./use-filter-query";

/**
 * Wraps the product grid so it reads as "catching up" while a filter change is
 * still in flight. The chips flip instantly (optimistic query string), which
 * without this would leave the list looking authoritative and wrong for as long
 * as the server render takes.
 *
 * The dim waits 300ms (`delay-300`, only on the way in): a fast render would
 * otherwise blink the whole grid to half opacity and back — read as flicker.
 */
export function CatalogResults({ children }: { children: React.ReactNode }) {
  const { isPending } = useFilterQuery();
  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-50 delay-300",
      )}
    >
      {children}
    </div>
  );
}
