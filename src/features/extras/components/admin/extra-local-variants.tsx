"use client";

import * as React from "react";
import { PackagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AdminExtraVariant } from "../../types";
import { newKey, type DraftVariant } from "./extra-draft";
import { ExtraImagesField } from "./extra-images-field";
import { ExtraStockDialog } from "./extra-stock-dialog";

/**
 * Хувилбарын хэлбэр ангиллаас (plan §18.4):
 *   batch — хоосон/бүтэн шил: хувилбар бүр нэг batch code (нэр = code);
 *   gift  — гоёмсог бэлгийн сав: чөлөөт нэр, хэмжээ, өөрийн зураг;
 *   plain — шприц г.м.: нэр, үнэ.
 */
export type LocalVariantKind = "batch" | "gift" | "plain";

/**
 * Энгийн барааны хувилбар: «Нэр · Үнэ (₮) · Үлдэгдэл · Зарна» хүснэгт (plan §7.2).
 *
 * Шинэ мөр 0 тоотой үүснэ — нөөц зөвхөн худалдан авалтаар (үнэ, огноотой)
 * орж тайланд зарлага болно (0153). Хадгалсан мөрийн тоог зөвхөн цонхоор
 * (зөрчил шалгалттай) — маягтын хадгалалт тоог хэзээ ч дарж бичихгүй.
 * Хадгалсан хувилбар устахгүй, идэвхгүй болно (захиалгын түүх түүнийг заадаг).
 */
export function ExtraLocalVariants({
  kind = "plain",
  productName,
  variants,
  saved,
  errors,
  onChange,
}: {
  kind?: LocalVariantKind;
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

  const nameLabel = kind === "batch" ? "Batch code" : "Нэр";
  // Десктопд нэг толгой мөр, мөр бүрт шошгогүй; утсан дээр мөр бүр карт,
  // шошго талбар бүрийн дээр (sm:sr-only).
  const cols = "sm:grid-cols-[minmax(0,1fr)_8rem_14.5rem_4rem]";

  return (
    <div className="space-y-3">
      <div className="border-border overflow-hidden rounded-lg sm:border">
        <div
          aria-hidden
          className={cn(
            "bg-muted/40 text-muted-foreground hidden gap-3 px-3 py-2 text-xs font-medium sm:grid",
            cols,
          )}
        >
          <span>{nameLabel}</span>
          <span>Үнэ (₮)</span>
          <span>Үлдэгдэл</span>
          <span className="text-center">Зарна</span>
        </div>
        <ul className="space-y-3 sm:space-y-0 sm:divide-y">
          {variants.map((v, i) => {
            const stock = v.id ? saved.get(v.id) : undefined;
            const labelErr = errors[`variants.${i}.label`];
            const priceErr = errors[`variants.${i}.price`];
            return (
              <li
                key={v.key}
                className={cn(
                  "border-border grid grid-cols-[minmax(0,1fr)_7rem] gap-3 rounded-lg border p-3 sm:items-start sm:rounded-none sm:border-0",
                  cols,
                  !v.isActive && "opacity-60",
                )}
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`${v.key}-label`} className="sm:sr-only">
                    {nameLabel}
                  </Label>
                  <Input
                    id={`${v.key}-label`}
                    value={v.label}
                    maxLength={60}
                    placeholder={
                      kind === "batch"
                        ? "Ж: A1234"
                        : kind === "gift"
                          ? "Ж: Жижиг хайрцаг"
                          : variants.length > 1
                            ? "Ж: 5ml"
                            : "Заавал биш"
                    }
                    aria-invalid={Boolean(labelErr)}
                    onChange={(e) =>
                      update(
                        i,
                        // Batch code нь хувилбарын нэр ч — ижил code давхардахгүй.
                        kind === "batch"
                          ? { label: e.target.value, batchCode: e.target.value }
                          : { label: e.target.value },
                      )
                    }
                  />
                  {labelErr && (
                    <p className="text-destructive text-xs">{labelErr}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${v.key}-price`} className="sm:sr-only">
                    Үнэ (₮)
                  </Label>
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
                <div className="col-span-2 space-y-1.5 sm:col-span-1">
                  <span className="text-sm font-medium sm:sr-only">
                    Үлдэгдэл
                  </span>
                  {stock ? (
                    <div className="flex min-h-10 items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm whitespace-nowrap tabular-nums">
                        <span className="font-medium">{stock.onHand ?? 0}</span>{" "}
                        ширхэг
                        {stock.reserved > 0 && (
                          <span className="text-muted-foreground block text-xs">
                            {stock.reserved} нь захиалгад
                          </span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setStockFor(stock)}
                      >
                        <PackagePlus className="size-4" aria-hidden />
                        Нөөц нөхөх
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground flex min-h-10 items-center text-xs">
                      Хадгалсны дараа нөөцөө оруулна
                    </p>
                  )}
                </div>
                <div className="col-span-2 flex min-h-10 items-center sm:col-span-1 sm:justify-center">
                  {v.id ? (
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <Checkbox
                        checked={v.isActive}
                        onCheckedChange={(c) =>
                          update(i, { isActive: c === true })
                        }
                        aria-label="Дэлгүүрт зарна"
                      />
                      <span className="sm:sr-only">Дэлгүүрт зарна</span>
                    </label>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={variants.length === 1}
                      onClick={() =>
                        onChange(variants.filter((_, j) => j !== i))
                      }
                      aria-label="Хувилбар хасах"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
                {kind === "gift" && (
                  <div className="col-span-full grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${v.key}-size`}>
                        Хэмжээ, тохирох сав
                      </Label>
                      <Input
                        id={`${v.key}-size`}
                        value={v.sizeNote}
                        maxLength={300}
                        placeholder="Ж: 8×5×4см · 10ml-ийн 2 сав багтана"
                        onChange={(e) =>
                          update(i, { sizeNote: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium">Зураг</span>
                      <ExtraImagesField
                        max={1}
                        value={v.imageUrl ? [v.imageUrl] : []}
                        onChange={(urls) =>
                          update(i, { imageUrl: urls[0] ?? "" })
                        }
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
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
              batchCode: "",
              sizeNote: "",
              imageUrl: "",
            },
          ])
        }
      >
        <Plus className="size-4" />{" "}
        {kind === "batch" ? "Batch code нэмэх" : "Хувилбар нэмэх"}
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
