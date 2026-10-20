"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AdminExtraVariant } from "../../types";
import { newKey, type DraftVariant } from "./extra-draft";
import { ExtraStockDialog } from "./extra-stock-dialog";

/**
 * Энгийн барааны хувилбар: «Нэр · Үнэ (₮) · Одоо байгаа тоо» (plan §7.2).
 *
 * Шинэ мөр 0 тоотой үүснэ — нөөц зөвхөн худалдан авалтаар (үнэ, огноотой)
 * орж тайланд зарлага болно (0153). Хадгалсан мөрийн тоог зөвхөн цонхоор
 * (зөрчил шалгалттай) — маягтын хадгалалт тоог хэзээ ч дарж бичихгүй. Хадгалсан хувилбар устахгүй, идэвхгүй болно (захиалгын түүх
 * түүнийг заадаг).
 */
export function ExtraLocalVariants({
  productName,
  variants,
  saved,
  errors,
  onChange,
}: {
  productName: string;
  variants: DraftVariant[];
  /** Хадгалсан хувилбарын нөөц — id-аар. */
  saved: Map<string, AdminExtraVariant>;
  /** `variants.<i>.label` / `.price` → мессеж. */
  errors: Record<string, string>;
  onChange: (next: DraftVariant[]) => void;
}) {
  const [stockFor, setStockFor] = React.useState<AdminExtraVariant | null>(
    null,
  );
  const update = (i: number, patch: Partial<DraftVariant>) =>
    onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {variants.map((v, i) => {
          const stock = v.id ? saved.get(v.id) : undefined;
          const labelErr = errors[`variants.${i}.label`];
          const priceErr = errors[`variants.${i}.price`];
          return (
            <li
              key={v.key}
              className={cn(
                "border-border grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_9rem_10rem_auto] sm:items-end",
                !v.isActive && "opacity-60",
              )}
            >
              <div className="space-y-1.5">
                <Label htmlFor={`${v.key}-label`}>Нэр</Label>
                <Input
                  id={`${v.key}-label`}
                  value={v.label}
                  maxLength={60}
                  placeholder={variants.length > 1 ? "Ж: Хар" : "Заавал биш"}
                  aria-invalid={Boolean(labelErr)}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
                {labelErr && (
                  <p className="text-destructive text-xs">{labelErr}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${v.key}-price`}>Үнэ (₮)</Label>
                <Input
                  id={`${v.key}-price`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={v.price}
                  aria-invalid={Boolean(priceErr)}
                  className="tabular-nums"
                  onChange={(e) => update(i, { price: e.target.value })}
                />
                {priceErr && (
                  <p className="text-destructive text-xs">{priceErr}</p>
                )}
              </div>
              {stock ? (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Одоо байгаа тоо</span>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm tabular-nums">
                      {stock.onHand ?? 0}
                      {stock.reserved > 0 && (
                        <span className="text-muted-foreground block text-xs">
                          {stock.reserved} захиалгад
                        </span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStockFor(stock)}
                    >
                      Нөөц засах
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs sm:pb-2.5">
                  Хадгалсны дараа «Нөөц нөхөх»-өөр тоо, авсан үнээ оруулна.
                </p>
              )}
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                {v.id ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <Checkbox
                      checked={v.isActive}
                      onCheckedChange={(c) =>
                        update(i, { isActive: c === true })
                      }
                    />
                    Зарна
                  </label>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={variants.length === 1}
                    onClick={() => onChange(variants.filter((_, j) => j !== i))}
                    aria-label="Хувилбар хасах"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...variants,
            {
              key: newKey(),
              label: "",
              price: "",
              isActive: true,
              sort: variants.length,
            },
          ])
        }
      >
        <Plus className="size-4" /> Хувилбар нэмэх
      </Button>
      {stockFor && (
        <ExtraStockDialog
          open
          onOpenChange={(o) => !o && setStockFor(null)}
          title={
            stockFor.label ? `${productName} — ${stockFor.label}` : productName
          }
          variant={stockFor}
        />
      )}
    </div>
  );
}
