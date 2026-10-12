"use client";

import * as React from "react";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSpinHistory } from "../use-wheel";
import type { SpinHistoryItem } from "../types";

function HistoryRow({ item }: { item: SpinHistoryItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.label}</p>
        <p className="text-muted-foreground text-xs">
          {formatDateTime(item.createdAt)}
          {item.spinType === "paid" && " · пойнтоор"}
          {item.spinType === "order" && " · захиалгын эрхээр"}
        </p>
      </div>
      {item.couponCode && (
        <code
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-xs tracking-wider",
            item.couponActive
              ? "bg-secondary text-foreground"
              : "text-muted-foreground/60 line-through",
          )}
        >
          {item.couponCode}
        </code>
      )}
    </li>
  );
}

/** Every spin, a page at a time — fetched only once the dialog opens. */
function FullHistory({ open }: { open: boolean }) {
  const history = useSpinHistory(open);
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  if (history.isPending) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    );
  }
  if (history.isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Түүх ачаалж чадсангүй. Дахин оролдоно уу.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-muted/60 divide-y">
        {items.map((item) => (
          <HistoryRow key={item.id} item={item} />
        ))}
      </ul>
      {history.hasNextPage && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
        >
          {history.isFetchingNextPage && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Цааш үзэх
        </Button>
      )}
    </div>
  );
}

/** The latest spins on the page, with the full list one tap away. */
export function SpinHistory({
  items,
  hasMore,
  className,
}: {
  items: SpinHistoryItem[];
  hasMore: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  if (items.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
          <History className="size-4" /> Миний эргэлтүүд
        </h2>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -mr-2"
            onClick={() => setOpen(true)}
          >
            Бүгдийг харах
          </Button>
        )}
      </div>
      <ul className="divide-muted/60 divide-y">
        {items.map((item) => (
          <HistoryRow key={item.id} item={item} />
        ))}
      </ul>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Миний эргэлтүүд"
        className="sm:max-w-lg"
      >
        <FullHistory open={open} />
      </ResponsiveDialog>
    </section>
  );
}
