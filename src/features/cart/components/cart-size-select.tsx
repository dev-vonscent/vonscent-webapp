"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/format";
import { useCart, type CartVariant } from "@/features/cart/store";
import type { ProductDetail } from "@/lib/types";

/**
 * Change the ml of a line already in the cart (todo.md B5).
 *
 * The sizes aren't in the persisted cart — a cart can sit in localStorage for
 * weeks, and a price or an in-stock flag from back then is exactly what we
 * must not re-use. They are fetched the first time the customer opens the
 * select, so an untouched cart costs no request.
 */
export function CartSizeSelect({
  itemKey,
  slug,
  variantId,
  ml,
  className,
}: {
  itemKey: string;
  slug: string;
  variantId: string;
  ml: number;
  className?: string;
}) {
  const setVariant = useCart((s) => s.setVariant);
  const [options, setOptions] = React.useState<
    (CartVariant & { inStock: boolean })[] | null
  >(null);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    if (options || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`);
      const data = res.ok ? await res.json() : null;
      const product = data?.product as ProductDetail | undefined;
      setOptions(
        (product?.variants ?? [])
          .filter((v) => v.isActive)
          .map((v) => ({
            variantId: v.id,
            ml: v.ml,
            unitPrice: v.price,
            inStock: v.inStock,
          })),
      );
    } finally {
      setLoading(false);
    }
  }

  function pick(id: string) {
    const next = options?.find((o) => o.variantId === id);
    if (!next || !next.inStock) return;
    setVariant(itemKey, {
      variantId: next.variantId,
      ml: next.ml,
      unitPrice: next.unitPrice,
    });
  }

  return (
    <Select value={variantId} onValueChange={pick} onOpenChange={load}>
      <SelectTrigger className={className} aria-label="Хэмжээ солих">
        {/* Until the list loads there is no matching item for `value`, so the
            current size is rendered as the placeholder. */}
        <SelectValue placeholder={`${ml}ml`} />
      </SelectTrigger>
      <SelectContent>
        {options === null ? (
          <SelectItem value={variantId} disabled>
            {loading ? "Ачаалж байна…" : `${ml}ml`}
          </SelectItem>
        ) : (
          options.map((o) => (
            <SelectItem
              key={o.variantId}
              value={o.variantId}
              disabled={!o.inStock}
            >
              {o.ml}ml ·{" "}
              {o.inStock ? formatPrice(o.unitPrice) : "дууссан"}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
