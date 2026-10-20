"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Package, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { ShopExtraListItem } from "../api";
import { bottleSizeText, stockText } from "../lib/display";

/**
 * Хоосон шил, «Шилтэй ус» (plan §18.5): нэг загвар дээр олон өөр үнэртний
 * шил — эрэмбэгүй, доошоо урсдаг жагсаалт. Нэрээр хайх, «Зөвхөн
 * үлдэгдэлтэй». Дууссан шил нуугдахгүй, «Үлдэгдэлгүй» гэж харагдана.
 */
export function ExtrasListView({ items }: { items: ShopExtraListItem[] }) {
  const [query, setQuery] = React.useState("");
  const [inStock, setInStock] = React.useState(false);

  const q = normalizeSearchText(query.trim());
  const shown = items.filter(
    (e) =>
      (!inStock || !e.soldOut) &&
      (!q ||
        normalizeSearchText(
          [e.name, e.leftover?.brand, e.leftover?.productName]
            .filter(Boolean)
            .join(" "),
        ).includes(q)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Үнэртний нэрээр хайх…"
            aria-label="Нэрээр хайх"
            className="px-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Цэвэрлэх"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm">
          <Checkbox
            checked={inStock}
            onCheckedChange={(c) => setInStock(c === true)}
          />
          Зөвхөн үлдэгдэлтэй
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {query
            ? `«${query.trim()}» нэртэй шил олдсонгүй.`
            : "Одоогоор үлдэгдэлтэй шил алга."}
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {shown.map((e) => (
            <li key={e.id}>
              <ListRow extra={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListRow({ extra }: { extra: ShopExtraListItem }) {
  const leftover = extra.leftover;
  const size = leftover
    ? `≈${leftover.remainingMl}/${leftover.fullMl}ml`
    : bottleSizeText(extra);
  const stock = leftover
    ? extra.soldOut
      ? "Зарагдсан"
      : "Ганц ширхэг"
    : stockText(extra);

  return (
    <Link
      href={`/extras/${extra.slug}`}
      className={cn(
        "hover:bg-secondary/60 -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors",
        extra.soldOut && "opacity-60",
      )}
    >
      <span className="bg-secondary relative aspect-4/5 w-14 shrink-0 overflow-hidden rounded-lg">
        {extra.image ? (
          <Image
            src={extra.image}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <Package
            className="text-muted-foreground absolute inset-0 m-auto size-5"
            aria-hidden
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {leftover && (
          <span className="text-muted-foreground block truncate text-[11px] tracking-[0.15em] uppercase">
            {leftover.brand}
          </span>
        )}
        <span className="line-clamp-2 font-serif text-base/tight font-medium">
          {extra.name}
        </span>
        <span className="text-muted-foreground block text-xs tabular-nums">
          {[size, stock].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-foreground/80 shrink-0 text-sm font-semibold whitespace-nowrap">
        {formatPrice(extra.fromPrice)}
      </span>
    </Link>
  );
}
