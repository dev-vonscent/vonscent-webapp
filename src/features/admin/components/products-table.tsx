"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { StockBadge } from "@/features/admin/components/stock-badge";
import { DataTable } from "@/features/admin/components/data-table";
import {
  ProductNameLink,
  ProductThumbLink,
} from "@/features/admin/components/product-thumb";
import { ProductRowActions } from "@/features/admin/components/product-row-actions";
import { adminFetch } from "@/features/admin/lib/mutate";
import type { AdminProduct } from "@/features/admin/api";
import { formatPrice } from "@/lib/format";
import { Star } from "lucide-react";

/**
 * The admin's single catalogue screen.
 *
 * `/admin/inventory` was a second list holding the same products with their ml
 * counts, and the two never linked to each other. It is gone: stock lives on
 * this row now, and every write reaches it through `ProductRowActions`.
 *
 * Reserved ml get a subline rather than a column of their own — the operator
 * only needs them on the rows where an order is actually holding stock, and a
 * three-column ml block pushed the table into permanent horizontal scroll.
 */
const columns: ColumnDef<AdminProduct, unknown>[] = [
  {
    id: "image",
    header: "Зураг",
    enableSorting: false,
    cell: ({ row }) => (
      <ProductThumbLink product={row.original} className="size-12" />
    ),
  },
  {
    accessorKey: "name",
    header: "Нэр",
    cell: ({ row }) => (
      <span className="flex max-w-56 items-center gap-1.5">
        <ProductNameLink
          product={row.original}
          className="block min-w-0 truncate"
        />
        {row.original.isFeatured && (
          <Star
            className="fill-gold-strong text-gold-strong size-3.5 shrink-0"
            aria-label="Онцлох бараа"
          />
        )}
      </span>
    ),
  },
  {
    accessorKey: "brand",
    header: "Брэнд",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "startingPrice",
    header: "Эхлэх үнэ",
    meta: { align: "right" },
    // Alignment comes from `meta.align`, so the header moves with the value.
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatPrice(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "availableMl",
    header: "Боломжит",
    meta: { align: "right" },
    cell: ({ row }) => {
      const p = row.original;
      return (
        <>
          <span className="block font-medium tabular-nums">
            {p.availableMl}ml
          </span>
          {p.reservedMl > 0 && (
            <span className="text-muted-foreground block text-xs tabular-nums">
              +{p.reservedMl}ml захиалагдсан
            </span>
          )}
        </>
      );
    },
  },
  {
    id: "status",
    header: "Төлөв",
    enableSorting: false,
    cell: ({ row }) => (
      <StockBadge
        availableMl={row.original.availableMl}
        lowStockMl={row.original.lowStockMl}
        isActive={row.original.isActive}
      />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ProductRowActions product={row.original} />
      </div>
    ),
  },
];

/**
 * Refresh the list once the images being generated land.
 *
 * One interval for the page, not one per row: the old cell polled from every
 * row that happened to be busy, so creating three AI products put three timers
 * and three requests every four seconds on the same screen.
 */
function useGenerationWatch(data: AdminProduct[]) {
  const router = useRouter();
  const busyIds = data
    .filter(
      (p) => p.imageStatus === "pending" || p.imageStatus === "generating",
    )
    .map((p) => p.id)
    .join(",");

  React.useEffect(() => {
    if (!busyIds) return;
    const iv = setInterval(async () => {
      const r = await adminFetch<{ statuses?: { status: string }[] }>(
        `/api/admin/products/image-status?ids=${busyIds}`,
      );
      const statuses = r.ok ? (r.data?.statuses ?? []) : [];
      const landed = statuses.some(
        (s) => s.status !== "pending" && s.status !== "generating",
      );
      // The server component owns the row data, so re-render it rather than
      // patching a copy of the truth in here.
      if (landed) router.refresh();
    }, 4000);
    return () => clearInterval(iv);
  }, [busyIds, router]);
}

export function ProductsTable({ data }: { data: AdminProduct[] }) {
  useGenerationWatch(data);
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyText="Бараа алга"
      label="Барааны жагсаалт"
      // Sorting already lives in the toolbar above, in the URL, where it
      // survives a refresh — a second phone-only sort would fight it.
      phoneSort={false}
      renderCard={(p) => (
        <div className="space-y-3">
          {/* The phone card carried every number but no picture — the one thing
              that identifies a bottle at a glance. It leads the card now, and
              it is the tap target for the editor alongside the name. */}
          <div className="flex items-start gap-3">
            <ProductThumbLink product={p} className="size-16" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
                {p.brand}
              </p>
              <ProductNameLink product={p} className="block truncate" />
            </div>
            <StockBadge
              availableMl={p.availableMl}
              lowStockMl={p.lowStockMl}
              isActive={p.isActive}
            />
          </div>
          {/* The same three numbers the stock dialog opens with, so the phone
              never has to guess what a correction is being measured against. */}
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Эхлэх үнэ</dt>
              <dd className="tabular-nums">{formatPrice(p.startingPrice)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Боломжит</dt>
              <dd className="font-medium tabular-nums">{p.availableMl}ml</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Захиалагдсан</dt>
              <dd className="text-muted-foreground tabular-nums">
                {p.reservedMl}ml
              </dd>
            </div>
          </dl>
          <ProductRowActions product={p} variant="block" />
        </div>
      )}
    />
  );
}
