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
import {
  extraFilterChips,
  extraFilterKey,
  extraKindName,
} from "../../lib/admin-filter";
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

function PriceText({ extra }: { extra: AdminExtra }) {
  if (extra.fromPrice == null)
    return <span className="text-muted-foreground">—</span>;
  const many =
    new Set(extra.variants.filter((v) => v.isActive).map((v) => v.price)).size >
    1;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatPrice(extra.fromPrice)}
      {many && "-өөс"}
    </span>
  );
}

/**
 * Зураг, нэр, ангилал нэг нүдэнд — тусдаа гурван багана 820px-ийн tablet-д
 * багтахгүй, «Төлөв», үйлдлийн товч тасардаг байв. Ангиллаар chip шүүнэ.
 * Тусдаа «Төлөв» багана ч үгүй (1024px + хажуугийн цэст багтдаггүй): бараг
 * бүгд «Нийтэлсэн» тул ноорог/архивласныг л нэрийн доор badge-аар.
 */
const columns: ColumnDef<AdminExtra, unknown>[] = [
  {
    accessorKey: "name",
    header: "Бараа",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Thumb extra={row.original} className="size-11" />
        <div className="min-w-0">
          <Link
            href={`/admin/extras/${row.original.id}`}
            className="block max-w-72 truncate font-medium hover:underline"
          >
            {row.original.name}
          </Link>
          <p className="text-muted-foreground flex items-center gap-2 truncate text-xs">
            {extraKindName(row.original)}
            {row.original.status !== "published" && (
              <StatusBadge extra={row.original} />
            )}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "fromPrice",
    header: "Үнэ",
    meta: { align: "right" },
    cell: ({ row }) => <PriceText extra={row.original} />,
  },
  {
    id: "stock",
    header: "Нөөц",
    enableSorting: false,
    cell: ({ row }) => <StockCell extra={row.original} />,
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
    ? extras.filter((e) => extraFilterKey(e) === activeCategory)
    : extras;
  const countBy = (key: string) =>
    extras.filter((e) => extraFilterKey(e) === key).length;

  return (
    <div className="space-y-4">
      <nav
        aria-label="Ангилал"
        // Утсан дээр ирмэг хүртэл гүйнэ (-mx-4), scrollbar-гүй — chip-ийн доорх
        // саарал зураас ачааллын мөр мэт харагддаг байв (design.md §6.1).
        className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
      >
        <FilterChip
          label={`Бүгд ${extras.length}`}
          href="/admin/extras"
          active={!activeCategory}
        />
        {extraFilterChips(categories).map((c) => (
          <FilterChip
            key={c.key}
            label={`${c.label} ${countBy(c.key)}`}
            href={`/admin/extras?cat=${c.key}`}
            active={activeCategory === c.key}
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
          // Нягт мөр: үйлдэл нь баруун дээд талд icon — бүтэн өргөнтэй
          // «Үйлдэл» товч карт бүрийг хоёр дахин өндөр болгодог байв. Төлөв
          // нь ихэнхдээ «Нийтэлсэн» тул зөвхөн ялгаатай үед badge.
          <div className="flex items-start gap-3">
            <Thumb extra={e} className="size-14" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-muted-foreground truncate text-xs">
                {extraKindName(e)}
              </p>
              <Link
                href={`/admin/extras/${e.id}`}
                className="line-clamp-2 leading-snug font-medium"
              >
                {e.name}
              </Link>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <PriceText extra={e} />
                <StockCell extra={e} />
                {e.status !== "published" && <StatusBadge extra={e} />}
              </p>
            </div>
            <ExtraRowActions extra={e} />
          </div>
        )}
      />
    </div>
  );
}
