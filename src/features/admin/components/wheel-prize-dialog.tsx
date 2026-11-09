"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { LoadingButton } from "@/components/shared/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpinPrizeKind, SpinTier } from "@/db/types";
import type { ProductOption } from "@/features/admin/lib/product-option";
import {
  KIND_LABEL,
  KIND_ORDER,
  TIER_LABEL,
  blankDraft,
  isCoupon,
  problemOf,
  type PrizeDraft,
} from "@/features/admin/lib/wheel-prizes";
import { WheelProductPicker } from "./wheel-product-picker";

/**
 * Нэг шагналыг нэмэх / засах popup (0170). Талбарууд төрлөөсөө хамаарна;
 * «Хадгалах» нь дуудагч талд бүтэн жагсаалтыг хадгалуулна.
 */
export function WheelPrizeDialog({
  open,
  onOpenChange,
  initial,
  productOptions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null id = a new prize. */
  initial: PrizeDraft;
  productOptions: ProductOption[];
  /** Resolves true once saved — the dialog then closes. */
  onSave: (draft: PrizeDraft) => Promise<boolean>;
}) {
  const [d, setD] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [tried, setTried] = React.useState(false);
  const set = (patch: Partial<PrizeDraft>) => setD((v) => ({ ...v, ...patch }));
  const problem = problemOf(d);

  function changeKind(kind: SpinPrizeKind) {
    // A different kind starts from that kind's defaults; the odds stay.
    setD({ ...blankDraft(kind), id: d.id, weight: d.weight });
  }

  async function save() {
    setTried(true);
    if (problem) return;
    setSaving(true);
    const ok = await onSave(d);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={d.id ? "Шагнал засах" : "Шагнал нэмэх"}
      className="sm:max-w-xl"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Төрөл">
            <Select
              value={d.kind}
              onValueChange={(v) => changeKind(v as SpinPrizeKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_ORDER.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Магадлал (%)" hint="Бүх шагналын нийлбэр 100">
            <Input
              inputMode="decimal"
              value={d.weight}
              onChange={(e) => set({ weight: e.target.value })}
            />
          </Field>
        </div>

        {d.kind === "product" && (
          <WheelProductPicker
            options={productOptions}
            productId={d.productId}
            ml={d.ml}
            onChange={({ productId, ml, product }) =>
              set({
                productId,
                ml,
                // Fill the names from the pick — still editable below.
                ...(product && ml
                  ? { label: `${product.name} ${ml}мл`, shortLabel: `${ml}мл` }
                  : {}),
              })
            }
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Нэр">
            <Input
              value={d.label}
              maxLength={60}
              onChange={(e) => set({ label: e.target.value })}
            />
          </Field>
          {d.kind !== "none" && (
            <Field label="Хүрдэн дээрх бичиг" hint="Богино байх тусам сайн">
              <Input
                value={d.shortLabel}
                maxLength={24}
                onChange={(e) => set({ shortLabel: e.target.value })}
              />
            </Field>
          )}
        </div>

        {d.kind !== "none" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(d.kind === "points" || isCoupon(d.kind)) && (
              <Field
                label={
                  d.kind === "coupon_percent"
                    ? "Хувь (%)"
                    : d.kind === "points"
                      ? "V point"
                      : "Дүн (₮)"
                }
              >
                <Input
                  inputMode="numeric"
                  value={d.value}
                  onChange={(e) => set({ value: e.target.value })}
                />
              </Field>
            )}
            {isCoupon(d.kind) && (
              <>
                <Field label="Доод дүн (₮)" hint="0 = хязгааргүй">
                  <Input
                    inputMode="numeric"
                    value={d.minSubtotal}
                    onChange={(e) => set({ minSubtotal: e.target.value })}
                  />
                </Field>
                <Field label="Дээд хөнгөлөлт (₮)" hint="Хоосон = хязгааргүй">
                  <Input
                    inputMode="numeric"
                    value={d.maxDiscount}
                    onChange={(e) => set({ maxDiscount: e.target.value })}
                  />
                </Field>
              </>
            )}
            <Field label="Зэрэглэл" hint="Хонжворын картын өнгө">
              <Select
                value={d.tier}
                onValueChange={(v) => set({ tier: v as SpinTier })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["common", "rare", "grand"] as const).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIER_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Сарын хязгаар" hint="Хоосон = хязгааргүй">
              <Input
                inputMode="numeric"
                value={d.monthlyCap}
                onChange={(e) => set({ monthlyCap: e.target.value })}
              />
            </Field>
          </div>
        )}

        {d.kind === "bundle" && (
          <p className="text-muted-foreground text-xs">
            Хожсон хэрэглэгч «Тохиргоо»-нд сонгосон эрэгтэй / эмэгтэй 2мл багцаас
            нэгийг сонгоно.
          </p>
        )}

        {tried && problem && (
          <p className="text-destructive text-sm">{problem}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <LoadingButton type="submit" loading={saving}>
            Хадгалах
          </LoadingButton>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
