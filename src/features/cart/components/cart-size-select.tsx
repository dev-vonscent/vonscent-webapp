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
  const [failed, setFailed] = React.useState(false);

  async function load() {
    if (options || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`);
      const data = res.ok ? await res.json() : null;
      const product = data?.product as ProductDetail | undefined;
      const next = (product?.variants ?? [])
        .filter((v) => v.isActive)
        .map((v) => ({
          variantId: v.id,
          ml: v.ml,
          unitPrice: v.price,
          inStock: v.inStock,
        }));
      // A deactivated or delisted product answers 404 / with no variants — a
      // real condition here, since a cart can sit in localStorage for weeks.
      // Say so instead of opening an empty list, and leave `options` null so
      // the next open retries.
      if (next.length === 0) {
        setFailed(true);
        return;
      }
      setOptions(next);
    } catch {
      setFailed(true);
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
        {/* The cart is the source of truth for the current size, so the
            trigger renders it directly — a failed or half-loaded list can
            never blank out the label. */}
        <SelectValue placeholder={`${ml}ml`}>{`${ml}ml`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options === null ? (
          <SelectItem value={variantId} disabled>
            {loading
              ? "Ачаалж байна…"
              : failed
                ? "Хэмжээ ачаалж чадсангүй"
                : `${ml}ml`}
          </SelectItem>
        ) : (
          options.map((o) => (
            <SelectItem
              key={o.variantId}
              value={o.variantId}
              disabled={!o.inStock}
            >
              {o.ml}ml · {o.inStock ? formatPrice(o.unitPrice) : "дууссан"}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
