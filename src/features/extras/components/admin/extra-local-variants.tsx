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
import { DatePicker } from "@/features/admin/components/date-picker";
import { formatPrice } from "@/lib/format";
import { ubToday } from "@/lib/time";
import { purchaseDateBounds } from "@/lib/validators/extras";
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
 * Нөөц зөвхөн худалдан авалтаар (үнэ, огноотой) орж тайланд зарлага болно
 * (0153). Шинэ мөрөнд «Эхний нөөц»-ийг шууд бичнэ — хадгалахад хувилбартай
 * НЭГ transaction-д худалдан авалт болно (0158). Хадгалсан мөрийн тоог
 * зөвхөн цонхоор (зөрчил шалгалттай) — маягт тоог хэзээ ч дарж бичихгүй.
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
                    <p className="text-muted-foreground flex min-h-10 items-center text-sm tabular-nums">
                      {initialText(v)}
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
                {!v.id && (
                  <InitialStock
                    v={v}
                    errors={errors}
                    prefix={`variants.${i}.initialPurchase`}
                    onChange={(p) => update(i, p)}
                  />
                )}
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

function initialText(v: DraftVariant) {
  const q = Number(v.initialQty?.replace(/[\s,]/g, ""));
  return v.initialQty?.trim() && Number.isInteger(q) && q > 0
    ? `${q} ширхэг`
    : "0 ширхэг";
}

/**
 * Шинэ мөрийн «Эхний нөөц»: ширхэг, нэгж авсан үнэ, авсан өдөр. Хоосон
 * орхивол нөөцгүй үүснэ — дараа нь «Нөөц нөхөх»-өөр нэмнэ.
 */
function InitialStock({
  v,
  errors,
  prefix,
  onChange,
}: {
  v: DraftVariant;
  errors: Record<string, string>;
  prefix: string;
  onChange: (patch: Partial<DraftVariant>) => void;
}) {
  const q = Number((v.initialQty ?? "").replace(/[\s,]/g, ""));
  const c = Number((v.initialUnitCost ?? "").replace(/[\s,]/g, ""));
  const total =
    v.initialQty?.trim() && v.initialUnitCost?.trim() && q > 0 && c >= 0
      ? q * c
      : null;
  const qtyErr = errors[`${prefix}.qty`];
  const costErr = errors[`${prefix}.unitCost`];
  const dayErr = errors[`${prefix}.purchasedOn`];

  return (
    <div className="bg-muted/40 col-span-full space-y-2 rounded-md p-3">
      <p className="text-xs">
        <span className="font-medium">Эхний нөөц</span>
        <span className="text-muted-foreground">
          {" "}
          — хадгалахад худалдан авалт болж тайланд орно. Хоосон орхивол дараа
          «Нөөц нөхөх»-өөр нэмнэ.
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[7rem_9rem_minmax(0,12rem)_1fr] sm:items-start">
        <div className="space-y-1.5">
          <Label htmlFor={`${v.key}-iq`} className="text-xs">
            Ширхэг
          </Label>
          <Input
            id={`${v.key}-iq`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={v.initialQty ?? ""}
            aria-invalid={Boolean(qtyErr)}
            className="tabular-nums"
            onChange={(e) => onChange({ initialQty: e.target.value })}
          />
          {qtyErr && <p className="text-destructive text-xs">{qtyErr}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${v.key}-ic`} className="text-xs">
            Нэгж авсан үнэ (₮)
          </Label>
          <Input
            id={`${v.key}-ic`}
            inputMode="numeric"
            autoComplete="off"
            value={v.initialUnitCost ?? ""}
            aria-invalid={Boolean(costErr)}
            className="tabular-nums"
            onChange={(e) => onChange({ initialUnitCost: e.target.value })}
          />
          {costErr && <p className="text-destructive text-xs">{costErr}</p>}
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <span className="text-xs font-medium">Авсан өдөр</span>
          <DatePicker
            value={v.initialPurchasedOn || ubToday()}
            onChange={(d) => onChange({ initialPurchasedOn: d })}
            clearable={false}
            aria-label="Авсан өдөр"
            {...purchaseDateBounds()}
          />
          {dayErr && <p className="text-destructive text-xs">{dayErr}</p>}
        </div>
        <p className="text-muted-foreground col-span-2 self-center text-xs tabular-nums sm:col-span-1 sm:pt-6">
          Нийт: {total == null ? "—" : formatPrice(total)}
        </p>
      </div>
    </div>
  );
}
