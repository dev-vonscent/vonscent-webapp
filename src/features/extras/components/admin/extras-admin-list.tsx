"use client";

import Link from "next/link";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { FilterChip } from "@/features/admin/components/filter-chip";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminExtra, ExtraCategory } from "../../types";
import { extraStockLabel, type StockTone } from "../../lib/stock";
import { ExtraRowActions } from "./extra-row-actions";

const STATUS_LABEL: Record<AdminExtra["status"], string> = {
  draft: "Ноорог",
  published: "Нийтэлсэн",
  archived: "Архивласан",
};

const TONE_CLASS: Record<StockTone, string> = {
  ok: "text-foreground",
  low: "text-gold-strong",
  out: "text-destructive",
  muted: "text-muted-foreground",
};

function Thumb({ extra, className }: { extra: AdminExtra; className: string }) {
  const src = extra.images[0] ?? extra.leftover?.productImage ?? null;
  return (
    <Link
      href={`/admin/extras/${extra.id}`}
      className={cn(
        "bg-secondary relative block shrink-0 overflow-hidden rounded-lg",
        className,
      )}
      aria-label={`${extra.name} засах`}
    >
      {src ? (
        <Image src={src} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center">
          <Package className="text-muted-foreground size-5" aria-hidden />
        </span>
      )}
    </Link>
  );
}

function StockCell({ extra }: { extra: AdminExtra }) {
  const s = extraStockLabel(extra);
  return (
    <span className={cn("text-sm whitespace-nowrap", TONE_CLASS[s.tone])}>
      {s.label}
    </span>
  );
}

function StatusBadge({ extra }: { extra: AdminExtra }) {
  return (
    <Badge
      variant={extra.status === "published" ? "new" : "secondary"}
      className="whitespace-nowrap"
    >
      {STATUS_LABEL[extra.status]}
    </Badge>
  );
}

const columns: ColumnDef<AdminExtra, unknown>[] = [
  {
    id: "image",
    header: "Зураг",
    enableSorting: false,
    cell: ({ row }) => <Thumb extra={row.original} className="size-12" />,
  },
  {
    accessorKey: "name",
    header: "Нэр",
    cell: ({ row }) => (
      <Link
        href={`/admin/extras/${row.original.id}`}
        className="block max-w-64 truncate font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "categoryName",
    header: "Ангилал",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "fromPrice",
    header: "Үнэ",
    meta: { align: "right" },
    cell: ({ row }) => {
      const e = row.original;
      if (e.fromPrice == null)
        return <span className="text-muted-foreground">—</span>;
      const many =
        new Set(e.variants.filter((v) => v.isActive).map((v) => v.price)).size >
        1;
      return (
        <span className="whitespace-nowrap tabular-nums">
          {formatPrice(e.fromPrice)}
          {many && "-өөс"}
        </span>
      );
    },
  },
  {
    id: "stock",
    header: "Нөөц",
    enableSorting: false,
    cell: ({ row }) => <StockCell extra={row.original} />,
  },
  {
    id: "status",
    header: "Төлөв",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge extra={row.original} />,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ExtraRowActions extra={row.original} />
      </div>
    ),
  },
];

/** Админ → Каталог → Нэмэлт бараа: ангиллын chip + жагсаалт (plan §7.1). */
export function ExtrasAdminList({
  extras,
  categories,
  activeCategory,
}: {
  extras: AdminExtra[];
  categories: ExtraCategory[];
  activeCategory: string | null;
}) {
  const shown = activeCategory
    ? extras.filter((e) => e.categorySlug === activeCategory)
    : extras;
  const countBy = (slug: string) =>
    extras.filter((e) => e.categorySlug === slug).length;

  return (
    <div className="space-y-4">
      <nav
        aria-label="Ангилал"
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        <FilterChip
          label={`Бүгд ${extras.length}`}
          href="/admin/extras"
          active={!activeCategory}
        />
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            label={`${c.name} ${countBy(c.slug)}`}
            href={`/admin/extras?cat=${c.slug}`}
            active={activeCategory === c.slug}
          />
        ))}
      </nav>
      <DataTable
        columns={columns}
        data={shown}
        label="Нэмэлт барааны жагсаалт"
        searchPlaceholder="Нэрээр хайх…"
        emptyText="Энэ ангилалд бараа алга байна."
        rowHref={(e) => `/admin/extras/${e.id}`}
        renderCard={(e) => (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Thumb extra={e} className="size-16" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
                  {e.categoryName}
                </p>
                <Link
                  href={`/admin/extras/${e.id}`}
                  className="line-clamp-2 font-medium"
                >
                  {e.name}
                </Link>
              </div>
              <StatusBadge extra={e} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Үнэ</dt>
                <dd className="whitespace-nowrap tabular-nums">
                  {e.fromPrice != null ? formatPrice(e.fromPrice) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Нөөц</dt>
                <dd>
                  <StockCell extra={e} />
                </dd>
              </div>
            </dl>
            <ExtraRowActions extra={e} variant="block" />
          </div>
        )}
      />
    </div>
  );
}
