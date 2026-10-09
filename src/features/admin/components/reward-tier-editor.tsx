"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeRewardLadder } from "@/features/admin/lib/reward-tiers";
import { formatPrice } from "@/lib/format";
import type { RewardTier } from "@/lib/validators/coupon";

const MAX_TIERS = 10;

function newTierId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tier-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Автомат урамшууллын купоны шатлалууд. Хэд хэдийг зэрэг асааж болох ч нэг
 * захиалга зөвхөн хүрсэн хамгийн өндөр шатлалынхаа купоныг авна — доорх
 * тойм яг тэр дүрмээр дүнгийн мужийг харуулна.
 */
export function RewardTierEditor({
  tiers,
  onChange,
}: {
  tiers: RewardTier[];
  onChange: (next: RewardTier[]) => void;
}) {
  const update = (id: string, patch: Partial<RewardTier>) =>
    onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function add() {
    const top = tiers.reduce((m, t) => Math.max(m, t.minTotal), 0);
    onChange([
      ...tiers,
      {
        id: newTierId(),
        enabled: true,
        minTotal: top > 0 ? top + 100_000 : 100_000,
        type: "percent",
        value: 10,
        validDays: 30,
        maxUsesPerUser: 1,
      },
    ]);
  }

  const ladder = describeRewardLadder(tiers);

  return (
    <div className="space-y-4">
      {tiers.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Шатлал алга — автомат купон олгогдохгүй.
        </p>
      )}

      {tiers.map((t, i) => (
        <div key={t.id} className="bg-muted/40 space-y-3 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={t.enabled}
                onCheckedChange={(c) => update(t.id, { enabled: Boolean(c) })}
              />
              Шатлал {i + 1}
              {!t.enabled && (
                <span className="text-muted-foreground font-normal">
                  (унтраасан)
                </span>
              )}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Шатлал ${i + 1}-ийг устгах`}
              onClick={() => onChange(tiers.filter((x) => x.id !== t.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {/* Гарчиг нэг нь хоёр мөр болсон ч input-ууд нэг шугамд байна. */}
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Доод дүн (₮)">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={t.minTotal || ""}
                onChange={(e) =>
                  update(t.id, { minTotal: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Төрөл">
              <Select
                value={t.type}
                onValueChange={(v) =>
                  update(t.id, { type: v === "fixed" ? "fixed" : "percent" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Хувь (%)</SelectItem>
                  <SelectItem value="fixed">Дүн (₮)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.type === "percent" ? "Хувь (%)" : "Дүн (₮)"}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={t.type === "percent" ? 100 : undefined}
                value={t.value || ""}
                onChange={(e) =>
                  update(t.id, { value: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Хугацаа (хоног)">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={t.validDays || ""}
                onChange={(e) =>
                  update(t.id, { validDays: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={add}
        disabled={tiers.length >= MAX_TIERS}
      >
        <Plus className="size-4" />
        Шатлал нэмэх
      </Button>

      {ladder.length > 0 && (
        <div className="bg-muted/50 space-y-1 rounded-lg p-4 text-sm">
          <p className="font-medium">Худалдан авагч юу авах вэ</p>
          <ul className="space-y-0.5">
            {ladder.map((row) => (
              <li key={row.id} className="tabular-nums">
                {row.to === null
                  ? `${formatPrice(row.from)} ба түүнээс дээш`
                  : `${formatPrice(row.from)} – ${formatPrice(row.to)}`}{" "}
                →{" "}
                <strong>
                  {row.type === "percent"
                    ? `${row.value}%`
                    : formatPrice(row.value)}{" "}
                  купон
                </strong>
                , {row.validDays} хоног хүчинтэй
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
