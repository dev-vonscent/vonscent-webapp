"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Crown,
  Loader2,
  Package,
  Save,
  Sparkles,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SpinWheelPrizeRow } from "@/db/types";
import type { WheelReport, WheelSettings } from "@/features/admin/api";

/**
 * Азын хүрдний удирдлага.
 *
 * Жин (weight) нь хувь биш харьцангуй тоо, тул админ нэг салбарыг өөрчлөхөд
 * бусдыг гараар 100% болгож тэнцүүлэх шаардлагагүй — багана бүрийн жинг нийт
 * дүнд харьцуулж энд шууд хувиар харуулна (docs/lucky-wheel.md §2-ын хүснэгт).
 */

const KIND_LABEL: Record<string, string> = {
  points: "V point",
  coupon_percent: "Хувийн купон",
  coupon_fixed: "Дүнгийн купон",
  bundle: "Бодит бэлэг",
};

const TIER_LABEL: Record<string, string> = {
  common: "Энгийн",
  rare: "Ховор",
  grand: "Гранд",
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  points: Sparkles,
  coupon_percent: Ticket,
  coupon_fixed: Ticket,
  bundle: Crown,
};

/** Editable copy of a prize row — every numeric field is a string while typing. */
interface Draft {
  id: string;
  slot: number;
  kind: string;
  tier: string;
  label: string;
  shortLabel: string;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  weight: string;
  monthlyCap: string;
  fallbackSlot: string;
  isActive: boolean;
}

function toDraft(row: SpinWheelPrizeRow): Draft {
  return {
    id: row.id,
    slot: row.slot,
    kind: row.kind,
    tier: row.tier,
    label: row.label,
    shortLabel: row.short_label,
    value: String(row.value),
    minSubtotal: String(row.min_subtotal),
    maxDiscount: row.max_discount == null ? "" : String(row.max_discount),
    weight: String(Number(row.weight)),
    monthlyCap: row.monthly_cap == null ? "" : String(row.monthly_cap),
    fallbackSlot: row.fallback_slot == null ? "" : String(row.fallback_slot),
    isActive: row.is_active,
  };
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const optional = (v: string) => (v.trim() === "" ? null : Math.trunc(num(v)));

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function LuckyWheelAdmin({
  prizes,
  settings,
  report,
}: {
  prizes: SpinWheelPrizeRow[];
  settings: WheelSettings;
  report: WheelReport;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(() =>
    prizes.map(toDraft),
  );
  const [config, setConfig] = React.useState(settings);
  const [busy, setBusy] = React.useState(false);
  const [fulfilling, setFulfilling] = React.useState<string | null>(null);

  const totalWeight = drafts.reduce(
    (sum, d) => sum + (d.isActive ? num(d.weight) : 0),
    0,
  );

  function edit<K extends keyof Draft>(id: string, key: K, value: Draft[K]) {
    setDrafts((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }

  async function save() {
    setBusy(true);
    const ok = await mutateJson(
      "/api/admin/lucky-wheel",
      "PUT",
      {
        settings: config,
        prizes: drafts.map((d) => ({
          id: d.id,
          label: d.label,
          shortLabel: d.shortLabel,
          value: Math.trunc(num(d.value)),
          minSubtotal: Math.trunc(num(d.minSubtotal)),
          maxDiscount: optional(d.maxDiscount),
          weight: num(d.weight),
          monthlyCap: optional(d.monthlyCap),
          fallbackSlot: optional(d.fallbackSlot),
          isActive: d.isActive,
        })),
      },
      "Хадгалж чадсангүй",
    );
    setBusy(false);
    if (ok) {
      toast.success("Хүрдний тохиргоо хадгалагдлаа");
      router.refresh();
    }
  }

  async function markFulfilled(spinId: string) {
    setFulfilling(spinId);
    const ok = await mutateJson(
      "/api/admin/lucky-wheel",
      "PATCH",
      { spinId, fulfilled: true },
      "Тэмдэглэж чадсангүй",
    );
    setFulfilling(null);
    if (ok) {
      toast.success("Хүргэсэн гэж тэмдэглэлээ");
      router.refresh();
    }
  }

  const drawn = new Map(report.bySlot.map((s) => [s.slot, s.count]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Азын хүрд</h1>
          <p className="text-muted-foreground text-sm">
            Магадлал, хязгаар, шагнал бүр эндээс тохируулагдана.
          </p>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Хадгалах
        </Button>
      </header>

      {/* ── Сүүлийн 30 хоног ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Нийт эргэлт (30 хоног)"
          value={report.spins.toLocaleString("mn-MN")}
          hint={`${report.freeSpins} үнэгүй · ${report.paidSpins} пойнтоор`}
        />
        <Stat
          label="Олгосон V point"
          value={report.pointsAwarded.toLocaleString("mn-MN")}
          hint={`${report.pointsSpent.toLocaleString("mn-MN")}V зарцуулагдсан`}
        />
        <Stat
          label="Олгосон купон"
          value={report.couponsIssued.toLocaleString("mn-MN")}
          hint={`${report.couponsUsed} нь ашиглагдсан`}
        />
        <Stat
          label="Цэвэр пойнтын урсгал"
          value={(report.pointsAwarded - report.pointsSpent).toLocaleString(
            "mn-MN",
          )}
          hint="Олгосон − зарцуулсан"
        />
      </section>

      {/* ── Хүлээгдэж буй бодит шагнал ───────────────────────────────── */}
      {report.pending.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Package className="size-4" />
            Хүргэгдээгүй бодит шагнал ({report.pending.length})
          </h2>
          <Card>
            <CardContent className="divide-muted/60 divide-y p-0">
              {report.pending.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.customer}
                      {item.phone ? ` · ${item.phone}` : ""} ·{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={fulfilling === item.id}
                    onClick={() => markFulfilled(item.id)}
                  >
                    {fulfilling === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Хүргэсэн
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Салбарууд ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Салбарууд ба магадлал</h2>
          <p className="text-muted-foreground text-xs">
            Нийт жин {totalWeight.toFixed(1)} — магадлал үүнээс харьцангуйгаар
            бодогдоно.
          </p>
        </div>

        <div className="space-y-3">
          {drafts.map((draft) => {
            const Icon = KIND_ICON[draft.kind] ?? Sparkles;
            const chance =
              totalWeight > 0 && draft.isActive
                ? (num(draft.weight) / totalWeight) * 100
                : 0;
            return (
              <Card
                key={draft.id}
                className={cn(!draft.isActive && "opacity-60")}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-secondary grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
                      {draft.slot}
                    </span>
                    <Icon className="text-muted-foreground size-4" />
                    <Badge
                      variant={draft.tier === "grand" ? "gold" : "secondary"}
                    >
                      {TIER_LABEL[draft.tier]}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {KIND_LABEL[draft.kind]}
                    </span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {chance.toFixed(1)}%
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        {chance > 0
                          ? `1 : ${Math.round(100 / chance)}`
                          : "хаалттай"}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      30 хоногт {drawn.get(draft.slot) ?? 0} удаа
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Нэр">
                      <Input
                        value={draft.label}
                        onChange={(e) =>
                          edit(draft.id, "label", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Хүрдэн дээрх бичиг">
                      <Input
                        value={draft.shortLabel}
                        onChange={(e) =>
                          edit(draft.id, "shortLabel", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={
                        draft.kind === "coupon_percent"
                          ? "Хувь (%)"
                          : draft.kind === "points"
                            ? "V point"
                            : draft.kind === "bundle"
                              ? "Ширхэг"
                              : "Дүн (₮)"
                      }
                    >
                      <Input
                        inputMode="numeric"
                        value={draft.value}
                        onChange={(e) =>
                          edit(draft.id, "value", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Жин">
                      <Input
                        inputMode="decimal"
                        value={draft.weight}
                        onChange={(e) =>
                          edit(draft.id, "weight", e.target.value)
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Доод дүн (₮)"
                      hint={
                        draft.kind.startsWith("coupon")
                          ? "0 = хязгааргүй"
                          : "Купонд л хамаарна"
                      }
                    >
                      <Input
                        inputMode="numeric"
                        value={draft.minSubtotal}
                        onChange={(e) =>
                          edit(draft.id, "minSubtotal", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Дээд хөнгөлөлт (₮)"
                      hint="Хоосон = хязгааргүй"
                    >
                      <Input
                        inputMode="numeric"
                        value={draft.maxDiscount}
                        onChange={(e) =>
                          edit(draft.id, "maxDiscount", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Сарын хязгаар" hint="Хоосон = хязгааргүй">
                      <Input
                        inputMode="numeric"
                        value={draft.monthlyCap}
                        onChange={(e) =>
                          edit(draft.id, "monthlyCap", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Хаалттай үед шилжих салбар"
                      hint="Салбарын дугаар"
                    >
                      <Input
                        inputMode="numeric"
                        value={draft.fallbackSlot}
                        onChange={(e) =>
                          edit(draft.id, "fallbackSlot", e.target.value)
                        }
                      />
                    </Field>
                  </div>

                  <label className="flex w-fit items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.isActive}
                      onCheckedChange={(v) =>
                        edit(draft.id, "isActive", v === true)
                      }
                    />
                    Идэвхтэй
                  </label>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Ерөнхий тохиргоо ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ерөнхий тохиргоо</h2>
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Үнэгүй эргэлтийн завсар (цаг)">
                <Input
                  inputMode="numeric"
                  value={config.freeSpinHours}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      freeSpinHours: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Нэмэлт эргэлтийн үнэ (V)">
                <Input
                  inputMode="numeric"
                  value={config.spinCost}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      spinCost: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Сард олгох V point-ийн дээд хэмжээ">
                <Input
                  inputMode="numeric"
                  value={config.monthlyPointCap}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      monthlyPointCap: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Ховор купон сард (удаа)">
                <Input
                  inputMode="numeric"
                  value={config.rareCouponPerMonth}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      rareCouponPerMonth: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field label="Купоны хүчинтэй хугацаа (хоног)">
                <Input
                  inputMode="numeric"
                  value={config.couponValidDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      couponValidDays: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
            </div>

            <div className="space-y-2">
              <label className="flex w-fit items-center gap-2 text-sm">
                <Checkbox
                  checked={config.enabled}
                  onCheckedChange={(v) =>
                    setConfig({ ...config, enabled: v === true })
                  }
                />
                Хүрд идэвхтэй
              </label>
              <label className="flex w-fit items-center gap-2 text-sm">
                <Checkbox
                  checked={config.singleActiveCoupon}
                  onCheckedChange={(v) =>
                    setConfig({ ...config, singleActiveCoupon: v === true })
                  }
                />
                Хүрднээс ашиглагдаагүй купон нэг дор нэг л байна
              </label>
            </div>

            <p className="text-muted-foreground text-xs">
              Идэвхтэй эргүүлэгчийн сарын зардлыг 100,000₮ захиалгын ~8%-д
              барихыг зорино (docs/lucky-wheel.md §5). Хэтэрвэл эхлээд пойнтын
              сарын хязгаарыг чангатгаж, дараа нь 10% купоны жинг бууруулна.
              Одоогийн дундаж шагналын нэрлэсэн үнэ (бодит бэлгийг оруулаагүй):{" "}
              <span className="text-foreground font-medium">
                {formatPrice(
                  Math.round(
                    drafts.reduce((sum, d) => {
                      if (!d.isActive || totalWeight <= 0) return sum;
                      const share = num(d.weight) / totalWeight;
                      const worth =
                        d.kind === "points"
                          ? num(d.value)
                          : d.kind === "coupon_fixed"
                            ? num(d.value)
                            : d.kind === "coupon_percent"
                              ? num(d.maxDiscount) ||
                                num(d.minSubtotal) * (num(d.value) / 100)
                              : 0;
                      return sum + share * worth;
                    }, 0),
                  ),
                )}
              </span>{" "}
              / эргэлт.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
