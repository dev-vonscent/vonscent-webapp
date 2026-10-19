"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EXTRAS_LOW_STOCK_QTY } from "@/lib/constants";
import { vialName } from "@/lib/vials";
import { cn } from "@/lib/utils";
import type { VialOption } from "../../types";
import { newKey, type DraftVariant } from "./extra-draft";

/**
 * Грамын сав: тоо оруулсан савнаас сонгоод ЗӨВХӨН үнэ бичнэ (plan §7.2).
 * Тоо нь `/admin/bottles`-д — үнэртэн ч энэ савыг хэрэглэдэг тул нэг нөөц.
 * 1ml сав (бэлгийн дээж) гарахгүй.
 */
export function ExtraVialVariants({
  vials,
  variants,
  errors,
  onChange,
}: {
  vials: VialOption[];
  variants: DraftVariant[];
  errors: Record<string, string>;
  onChange: (next: DraftVariant[]) => void;
}) {
  const sellable = vials.filter((v) => v.ml !== 1);
  const indexOf = (vialId: string) =>
    variants.findIndex((d) => d.vialId === vialId);

  function toggle(v: VialOption, on: boolean) {
    const i = indexOf(v.id);
    if (on && i < 0) {
      onChange([
        ...variants,
        {
          key: newKey(),
          vialId: v.id,
          label: "",
          price: "",
          isActive: true,
          sort: variants.length,
          initialQty: "",
        },
      ]);
    } else if (!on && i >= 0) {
      onChange(variants.filter((_, j) => j !== i));
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground hidden grid-cols-[1.5rem_1fr_8rem_4rem_5rem_6rem] gap-3 px-3 text-xs sm:grid">
        <span />
        <span>Сав</span>
        <span>Үнэ (₮)</span>
        <span className="text-right">Нийт</span>
        <span className="text-right">Захиалгад</span>
        <span className="text-right">Зарах боломжтой</span>
      </div>
      <ul className="space-y-2">
        {sellable.map((v) => {
          const i = indexOf(v.id);
          const on = i >= 0;
          const counted = v.onHand != null;
          const priceErr = on ? errors[`variants.${i}.price`] : undefined;
          const low =
            v.available != null &&
            v.available <= Math.max(v.lowThreshold, EXTRAS_LOW_STOCK_QTY);
          return (
            <li
              key={v.id}
              className={cn(
                "border-border grid grid-cols-[1.5rem_1fr] items-center gap-x-3 gap-y-2 rounded-lg border p-3 sm:grid-cols-[1.5rem_1fr_8rem_4rem_5rem_6rem]",
                !counted && "bg-muted/30",
              )}
            >
              <Checkbox
                checked={on}
                disabled={!counted || !v.isActive}
                onCheckedChange={(c) => toggle(v, c === true)}
                aria-label={`${vialName(v)} сонгох`}
              />
              <span className="text-sm font-medium">
                {vialName(v)}
                {!counted && (
                  <Link
                    href="/admin/bottles"
                    className="text-muted-foreground block text-xs font-normal underline-offset-2 hover:underline"
                  >
                    Эхлээд Савны нөөцөд тоо оруулна уу
                  </Link>
                )}
                {counted && !v.isActive && (
                  <span className="text-muted-foreground block text-xs font-normal">
                    Түр хаасан
                  </span>
                )}
              </span>
              <div className="col-start-2 sm:col-start-auto">
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`${vialName(v)} үнэ (₮)`}
                  placeholder="Үнэ (₮)"
                  disabled={!on}
                  value={on ? variants[i].price : ""}
                  aria-invalid={Boolean(priceErr)}
                  className="tabular-nums"
                  onChange={(e) =>
                    onChange(
                      variants.map((d, j) =>
                        j === i ? { ...d, price: e.target.value } : d,
                      ),
                    )
                  }
                />
                {priceErr && (
                  <p className="text-destructive mt-1 text-xs">{priceErr}</p>
                )}
              </div>
              <dl className="col-start-2 grid grid-cols-3 gap-2 text-sm tabular-nums sm:col-span-3 sm:col-start-auto sm:grid-cols-subgrid sm:text-right">
                <div>
                  <dt className="text-muted-foreground text-xs sm:sr-only">
                    Нийт
                  </dt>
                  <dd>{counted ? v.onHand : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs sm:sr-only">
                    Захиалгад
                  </dt>
                  <dd>{v.reserved}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs sm:sr-only">
                    Зарах боломжтой
                  </dt>
                  <dd className="font-medium">
                    {counted ? v.available : "—"}
                    {counted && low && (
                      <span className="text-gold-strong ml-1 text-xs font-normal">
                        Цөөхөн
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      {errors["variants"] && (
        <p className="text-destructive text-xs">{errors["variants"]}</p>
      )}
    </div>
  );
}
