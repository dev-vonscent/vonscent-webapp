"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ML_SIZES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

export interface VariantDraft {
  ml: number;
  /** The ₮ price the admin typed — what the customer pays, as-is. */
  price: number;
  active: boolean;
}

/** A blank price row per size, for the create form. */
export function emptyVariants(): VariantDraft[] {
  return ML_SIZES.map((ml) => ({ ml, price: 0, active: true }));
}

/**
 * Per-size price entry (requirement.md A2). The admin types the price of each
 * decant size directly — there is no coefficient and no derived price, so what
 * is typed here is what the storefront charges.
 */
export function VariantPriceTable({
  variants,
  onChange,
}: {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
}) {
  function update(ml: number, patch: Partial<VariantDraft>) {
    onChange(variants.map((v) => (v.ml === ml ? { ...v, ...patch } : v)));
  }

  return (
    <div className="space-y-2">
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[320px] text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Багц</th>
              <th className="px-3 py-2 font-medium">Үнэ (₮)</th>
              <th className="px-3 py-2 font-medium">1ml</th>
              <th className="px-3 py-2 font-medium">Зарна</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.ml} className="border-border border-t">
                <td className="px-3 py-2 font-medium">{v.ml}ml</td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100}
                    className="h-8 w-32"
                    value={v.price === 0 ? "" : v.price}
                    placeholder="0"
                    onChange={(e) =>
                      update(v.ml, {
                        price: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </td>
                {/* Not a pricing input — just so the admin can eyeball whether
                    the three sizes are priced consistently. */}
                <td className="text-muted-foreground px-3 py-2">
                  {v.price > 0 ? formatPrice(Math.round(v.price / v.ml)) : "—"}
                </td>
                <td className="px-3 py-2">
                  <Checkbox
                    checked={v.active}
                    onCheckedChange={(c) =>
                      update(v.ml, { active: Boolean(c) })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        Хэмжээ тус бүрийн үнийг гараар бичнэ. «Зарна»-г авбал тухайн хэмжээ
        худалдаанаас түр гарна (үлдэгдэл дуусахаас үл хамааран).
      </p>
    </div>
  );
}
