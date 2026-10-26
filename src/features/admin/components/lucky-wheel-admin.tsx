"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Heart, Loader2, Save, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { ASSUMED_AOV } from "@/lib/constants";
import type { SpinWheelPrizeRow } from "@/db/types";
import type {
  GrandAdminRow,
  GrandBundleChoice,
  WheelReport,
  WheelSettings,
} from "@/features/admin/api";
import { GrandPrizesAdmin } from "./grand-prizes-admin";

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
  bundle: "2мл багц (гранд)",
  none: "Баярлалаа (шагналгүй)",
};

const TIER_LABEL: Record<string, string> = {
  common: "Энгийн",
  rare: "Ховор",
  grand: "Гранд",
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  points: VPointIcon,
  coupon_percent: Ticket,
  coupon_fixed: Ticket,
  bundle: Crown,
  none: Heart,
};

/** Radix Select has no empty value — this stands for «no bundle». */
const NONE = "none";

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

/**
 * Нэг хожилтын нэрлэсэн үнэ ₮-өөр — админы «дундаж шагнал / эргэлт»-д л
 * хэрэглэнэ (docs/lucky-wheel.md §3-ын «Нэрлэсэн» багана).
 *
 * Хувиар хөнгөлөх купоныг **сагсанд харьцуулж** үнэлнэ: дээд хязгаар (`maxDiscount`)
 * тавьсан бол түүгээр тагласан, үгүй бол ASSUMED_AOV дээрх бүтэн хувь. Урьд нь
 * энэ нь `maxDiscount || minSubtotal * value/100` байсан — 2026-09-07-оос хойш
 * хүрдний хувийн купон хязгааргүй, доод хязгааргүй болсон тул хоёулаа 0 болж,
 * 5% ба 10% купон тооцоонд бүрэн орохоо больж байв.
 */
function nominalWorth(
  kind: string,
  value: number,
  maxDiscount: number,
): number {
  if (kind === "points" || kind === "coupon_fixed") return value;
  if (kind !== "coupon_percent") return 0;
  const full = (ASSUMED_AOV * value) / 100;
  return maxDiscount > 0 ? Math.min(full, maxDiscount) : full;
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
  grand,
  bundleChoices,
}: {
  prizes: SpinWheelPrizeRow[];
  settings: WheelSettings;
  report: WheelReport;
  grand: GrandAdminRow[];
  bundleChoices: GrandBundleChoice[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(() =>
    prizes.map(toDraft),
  );
  const [config, setConfig] = React.useState(settings);
  const [busy, setBusy] = React.useState(false);

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
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Нийт эргэлт (30 хоног)"
          value={report.spins.toLocaleString("mn-MN")}
          hint={`${report.freeSpins} үнэгүй · ${report.orderSpins} захиалгаар · ${report.paidSpins} пойнтоор`}
        />
        <Stat
          label="Захиалгаас олгосон эрх"
          value={report.orderSpinsGranted.toLocaleString("mn-MN")}
          hint={`${report.thanks.toLocaleString("mn-MN")} эргэлт «Баярлалаа» дээр буусан`}
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

      {/* ── Гранд шагнал: хожсоноос хүргэлт хүртэл (0165) ─────────────── */}
      <GrandPrizesAdmin rows={grand} />

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
            const Icon = KIND_ICON[draft.kind] ?? VPointIcon;
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
                    {draft.kind !== "none" && (
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
                    )}
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

                  {draft.kind !== "none" && (
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
                  )}

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
              <Field label="Захиалгын хэдэн ₮ тутамд нэг эрх (0 = унтраах)">
                <Input
                  inputMode="numeric"
                  value={config.orderSpinStep}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      orderSpinStep: Number(e.target.value) || 0,
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
              <Field label="Сард олгох V point-ийн дээд хэмжээ (0 = хязгааргүй)">
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
              <Field label="Ховор купон сард, удаа (0 = хязгааргүй)">
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

            {/* Гранд шагнал (0165): хэрэглэгч эдгээр хоёроос нэгийг сонгоно. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(["male", "female"] as const).map((g) => (
                <Field
                  key={g}
                  label={`Гранд шагнал — ${g === "male" ? "эрэгтэй" : "эмэгтэй"} багц (2мл)`}
                >
                  <Select
                    value={config.grandBundles[g] ?? NONE}
                    onValueChange={(v) =>
                      setConfig({
                        ...config,
                        grandBundles: {
                          ...config.grandBundles,
                          [g]: v === NONE ? null : v,
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Сонгоогүй" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Сонгоогүй</SelectItem>
                      {/* Эрэгтэй шагналд эрэгтэй + unisex, эмэгтэйд эмэгтэй +
                          unisex — эсрэг хүйсийн багц санал болгохгүй. */}
                      {bundleChoices
                        .filter((c) => c.gender === g || c.gender === "unisex")
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {formatPrice(c.price)}
                            {c.available ? "" : " · 2мл дууссан"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
              <Field label="Шагналаа авах хугацаа (хоног)">
                <Input
                  inputMode="numeric"
                  value={config.bundleClaimDays}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      bundleClaimDays: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
            </div>
            {(!config.grandBundles.male || !config.grandBundles.female) && (
              <p className="text-destructive text-xs">
                Гранд шагналын хоёр багцыг хоёуланг нь сонгоно уу — эс бөгөөс
                хожсон хэрэглэгч сонгох юмгүй үлдэнэ.
              </p>
            )}

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
              Эрх гурван замаар: {config.freeSpinHours} цагт нэг үнэгүй,
              захиалгын {formatPrice(config.orderSpinStep)} тутамд нэг,{" "}
              {config.spinCost.toLocaleString("mn-MN")}V-оор нэг. Сарын таг
              унтраалттай (0) — зардлыг жин ба эдгээр тохиргоогоор барина
              (docs/lucky-wheel.md §9). Одоогийн дундаж шагналын нэрлэсэн үнэ
              (бодит бэлгийг оруулаагүй):{" "}
              <span className="text-foreground font-medium">
                {formatPrice(
                  Math.round(
                    drafts.reduce((sum, d) => {
                      if (!d.isActive || totalWeight <= 0) return sum;
                      const share = num(d.weight) / totalWeight;
                      return (
                        sum +
                        share *
                          nominalWorth(d.kind, num(d.value), num(d.maxDiscount))
                      );
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
