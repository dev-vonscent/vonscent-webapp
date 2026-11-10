"use client";

import * as React from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/features/admin/lib/mutate";
import { formatPrice } from "@/lib/format";
import { numAblative } from "@/lib/mn-grammar";
import type { AdminLeftover } from "../../types";
import type { DraftLeftover } from "./extra-draft";
import { LeftoverPerfumePicker } from "./leftover-perfume-picker";

/** Жагсаалтад түгжсэн ml-ийг оруулаад сольж болох дээд хэмжээ (§5.5). */
export function leftoverMaxMl(
  draft: DraftLeftover,
  saved: AdminLeftover | null,
): number {
  const sameProduct = saved?.productId === draft.productId;
  const relock =
    sameProduct && saved?.lockState === "listed" ? (saved.lockedMl ?? 0) : 0;
  return draft.productAvailableMl + relock;
}

/**
 * Үлдэгдэлтэй шил: «Аль үнэртний шил вэ?» → үлдсэн / бүтэн савны ml → үнэ
 * (plan §7.2). Хувилбарын хүснэгт, тооны талбар байхгүй — 1 ширхэг.
 * Захиалгад орсон / зарагдсан шилийг засахгүй.
 */
export function ExtraLeftoverFields({
  value,
  price,
  saved,
  errors,
  onChange,
  onPriceChange,
}: {
  value: DraftLeftover | null;
  price: string;
  saved: AdminLeftover | null;
  errors: Record<string, string>;
  onChange: (next: DraftLeftover | null) => void;
  onPriceChange: (next: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const locked =
    saved?.lockState === "reserved" || saved?.lockState === "committed";

  async function pick(id: string | null) {
    if (!id) {
      onChange(null);
      return;
    }
    setLoading(true);
    const res = await adminFetch<{
      id: string;
      name: string;
      brand: string;
      bottleMl: number;
      image: string | null;
      availableMl: number;
    }>(`/api/admin/extras/perfume/${id}`);
    setLoading(false);
    if (!res.ok) return;
    const p = res.data;
    onChange({
      productId: p.id,
      productName: p.name,
      productBrand: p.brand,
      productImage: p.image,
      productAvailableMl: p.availableMl,
      remainingMl: value?.remainingMl ?? "",
      fullMl: value?.fullMl || String(p.bottleMl),
    });
  }

  const remaining = Number(value?.remainingMl ?? "");
  const max = value ? leftoverMaxMl(value, saved) : 0;
  const overMax = value != null && remaining > 0 && remaining > max;
  const priceNum = Number(price.replace(/[\s,]/g, ""));
  const perMl =
    remaining > 0 && priceNum > 0 ? Math.round(priceNum / remaining) : null;

  return (
    <div className="space-y-4">
      {locked && (
        <p className="bg-secondary rounded-md px-3 py-2 text-sm">
          {saved?.lockState === "committed"
            ? "Энэ шил зарагдсан тул засах боломжгүй."
            : "Энэ шил захиалгад орсон тул одоо засах боломжгүй."}
        </p>
      )}
      <Field
        label="Аль үнэртний шил вэ?"
        error={errors["productId"]}
        hint="Эх үнэртний декантын нөөцөөс үлдсэн ml түгжигдэнэ."
      >
        <LeftoverPerfumePicker
          disabled={locked || loading}
          value={
            value
              ? {
                  id: value.productId,
                  name: value.productName,
                  brand: value.productBrand,
                }
              : null
          }
          onChange={(p) => void pick(p?.id ?? null)}
        />
      </Field>
      {value && (
        <div className="bg-muted/40 flex items-center gap-3 rounded-lg p-3">
          <div className="bg-secondary relative size-14 shrink-0 overflow-hidden rounded-md">
            {value.productImage ? (
              <Image
                src={value.productImage}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Package className="text-muted-foreground size-5" aria-hidden />
              </span>
            )}
          </div>
          <div className="min-w-0 text-sm">
            <p className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
              {value.productBrand}
            </p>
            <p className="truncate font-medium">{value.productName}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              Декантын нөөцөд {value.productAvailableMl}ml
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Үлдсэн хэмжээ (ml)"
          error={
            errors["remainingMl"] ??
            (overMax
              ? `Энэ үнэртний нөөцөд ${max}ml л байна. ${numAblative(max)} их ml оруулах боломжгүй.`
              : undefined)
          }
        >
          <Input
            inputMode="numeric"
            autoComplete="off"
            disabled={locked}
            value={value?.remainingMl ?? ""}
            className="tabular-nums"
            onChange={(e) =>
              value && onChange({ ...value, remainingMl: e.target.value })
            }
          />
        </Field>
        <Field label="Бүтэн савны хэмжээ (ml)" error={errors["fullMl"]}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            disabled={locked}
            value={value?.fullMl ?? ""}
            className="tabular-nums"
            onChange={(e) =>
              value && onChange({ ...value, fullMl: e.target.value })
            }
          />
        </Field>
      </div>
      <Field
        label="Зарах үнэ (₮)"
        error={errors["price"]}
        hint={
          perMl != null ? `1ml ≈ ${formatPrice(perMl)} (мэдээлэл)` : undefined
        }
      >
        <Input
          inputMode="numeric"
          autoComplete="off"
          disabled={locked}
          value={price}
          className="tabular-nums"
          onChange={(e) => onPriceChange(e.target.value)}
        />
      </Field>
    </div>
  );
}
