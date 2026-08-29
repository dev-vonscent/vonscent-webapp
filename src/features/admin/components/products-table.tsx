"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StockBadge } from "@/features/admin/components/stock-badge";
import { DataTable } from "@/features/admin/components/data-table";
import { ProductImageCell } from "@/features/admin/components/product-image-cell";
import { ProductRowActions } from "@/features/admin/components/product-row-actions";
import type { AdminProduct } from "@/features/admin/api";
import { formatPrice } from "@/lib/format";

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
    cell: ({ row }) => {
      const p = row.original;
      return (
        <ProductImageCell
          product={{
            id: p.id,
            name: p.name,
            isActive: p.isActive,
            imageUrl: p.imageUrl,
            imageStatus: p.imageStatus,
            imageResultUrl: p.imageResultUrl,
            imageGenId: p.imageGenId,
            imagePrompt: p.imagePrompt,
            imageError: p.imageError,
          }}
        />
      );
    },
  },
  {
    accessorKey: "name",
    header: "Нэр",
    cell: ({ getValue }) => (
      <span
        className="block max-w-56 truncate font-medium"
        title={getValue<string>()}
      >
        {getValue<string>()}
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

export function ProductsTable({ data }: { data: AdminProduct[] }) {
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
                {p.brand}
              </p>
              <p className="font-medium">{p.name}</p>
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
