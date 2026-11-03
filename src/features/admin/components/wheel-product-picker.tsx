"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/format";
import { ML_SIZES } from "@/lib/constants";
import { useProductOptions } from "@/features/admin/hooks/use-product-options";
import type { ProductOption } from "@/features/admin/lib/product-option";

/**
 * «Бодит бараа» шагналын бараа ба хэмжээ (0170). Хайлт нь сервер дээр
 * (`useProductOptions`); хэмжээ нь тэр барааны идэвхтэй хэмжээнүүдээс.
 *
 * Нөөц энд барихгүй — хэрэглэгч хожоод захиалга өгөх үед reserve хийгдэнэ, бараа
 * дууссан үед хүрд энэ нүдийг сугалахгүй (`spin_product_available`).
 */
export function WheelProductPicker({
  options,
  productId,
  ml,
  onChange,
}: {
  options: ProductOption[];
  productId: string | null;
  ml: number | null;
  onChange: (next: {
    productId: string | null;
    ml: number | null;
    product: ProductOption | null;
  }) => void;
}) {
  const { q, setQ, items, loading, byId } = useProductOptions(options);
  const picked = productId ? byId(productId) : undefined;
  const sizes = picked
    ? ML_SIZES.filter((s) => picked.priceByMl[s] !== undefined)
    : [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
      <Field label="Бараа">
        {productId ? (
          <div className="bg-secondary flex min-h-9 items-center gap-2 rounded-md px-3 py-1.5 text-sm">
            <Check className="text-gold-strong size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {picked ? (
                <>
                  <span className="text-muted-foreground mr-1.5 text-xs uppercase">
                    {picked.brand}
                  </span>
                  {picked.name}
                </>
              ) : (
                "Бараа олдсонгүй"
              )}
            </span>
            <button
              type="button"
              aria-label="Барааг солих"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ productId: null, ml, product: null })}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Нэр, брэндээр хайх…"
              aria-label="Шагналын барааг хайх"
            />
            <div
              className={`bg-muted/40 max-h-48 overflow-y-auto rounded-md transition-opacity ${
                loading ? "opacity-60" : ""
              }`}
              aria-busy={loading}
            >
              {items.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">
                  {loading ? "Хайж байна…" : "Илэрц алга."}
                </p>
              ) : (
                <ul className="[&>li:nth-child(even)]:bg-secondary/60">
                  {items.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const keep =
                            ml !== null && p.priceByMl[ml] !== undefined;
                          const first = ML_SIZES.find(
                            (s) => p.priceByMl[s] !== undefined,
                          );
                          onChange({
                            productId: p.id,
                            ml: keep ? ml : (first ?? null),
                            product: p,
                          });
                        }}
                        className="hover:bg-accent flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm md:min-h-9"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-muted-foreground mr-2 text-xs uppercase">
                            {p.brand}
                          </span>
                          {p.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {p.availableMl}мл үлдэгдэл
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Field>

      <Field
        label="Хэмжээ"
        hint={
          picked && ml
            ? `Үнэ ${formatPrice(picked.priceByMl[ml] ?? 0)} · үлдэгдэл ${picked.availableMl}мл`
            : undefined
        }
      >
        <Select
          value={ml ? String(ml) : undefined}
          onValueChange={(v) =>
            onChange({ productId, ml: Number(v), product: picked ?? null })
          }
          disabled={!picked}
        >
          <SelectTrigger>
            <SelectValue placeholder="Хэмжээ" />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}мл
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
