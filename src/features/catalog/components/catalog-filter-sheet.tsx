"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CatalogFilters } from "./catalog-filters";
import { useFilterQuery } from "./use-filter-query";
import type { ScentFamilyOption } from "@/lib/types";

/**
 * Mobile filter sheet — slides down from the top, full width with a rounded
 * bottom and a bottom gap. The grab handle at the bottom can be dragged up to
 * dismiss.
 */
export function CatalogFilterSheet({
  brands,
  priceBounds,
  families,
}: {
  brands: string[];
  priceBounds: { min: number; max: number };
  families: ScentFamilyOption[];
}) {
  const { activeCount } = useFilterQuery();
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const startY = React.useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (contentRef.current) contentRef.current.style.transition = "none";
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startY.current === null || !contentRef.current) return;
    const dy = Math.min(0, e.clientY - startY.current); // only allow dragging up
    contentRef.current.style.transform = `translateY(${dy}px)`;
  }

  function endDrag(e: React.PointerEvent) {
    if (startY.current === null || !contentRef.current) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    contentRef.current.style.transition = "";
    contentRef.current.style.transform = "";
    if (dy < -60) setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="relative shrink-0 lg:hidden"
          aria-label="Шүүлтүүр"
        >
          <SlidersHorizontal className="size-4" />
          {activeCount > 0 && (
            <span className="bg-foreground text-background absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        side="top"
        overlayClassName="bg-black/10"
        className="border-border bg-card/60 flex max-h-[80vh] flex-col gap-4 rounded-b-2xl pb-3 backdrop-blur-lg lg:hidden"
      >
        <SheetTitle className="sr-only">Шүүлтүүр</SheetTitle>
        <div className="no-scrollbar -mx-2 flex-1 overflow-y-auto px-2">
          <CatalogFilters
            brands={brands}
            priceBounds={priceBounds}
            families={families}
          />
        </div>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Хаах"
          className="flex w-full touch-none items-center justify-center pt-2"
        >
          <span className="bg-muted-foreground/40 h-1.5 w-12 rounded-full" />
        </button>
      </SheetContent>
    </Sheet>
  );
}
