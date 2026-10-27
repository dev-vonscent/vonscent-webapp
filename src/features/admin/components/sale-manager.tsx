"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/shared/loading-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mutateJson } from "@/features/admin/lib/mutate";
import { DatePicker } from "@/features/admin/components/date-picker";
import { Field } from "@/components/ui/field";
import {
  dayEndIso,
  dayStartIso,
  ubToday,
} from "@/features/admin/lib/date-range";
import { isSaleActive } from "@/features/products/sale";
import { GENDERS, GENDER_LABEL, ML_SIZES } from "@/lib/constants";
import type { Gender } from "@/db/types";
import { formatDateTime, formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { BULK_SALE_MAX_PCT, bulkSalePrice } from "@/lib/validators/sale";

export interface SaleVariant {
  ml: number;
  price: number;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
}

export interface SaleProduct {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  variants: SaleVariant[];
}

type Phase = "active" | "scheduled" | "ended";

const PHASE_LABEL: Record<Phase, string> = {
  active: "Хүчинтэй",
  scheduled: "Эхлээгүй",
  ended: "Дууссан",
};

/** Барааны хямдралын төлөв — аль нэг хэмжээ хүчинтэй бол «Хүчинтэй». */
function phaseOf(p: SaleProduct, now: number): Phase | null {
  const sale = p.variants.filter((v) => v.salePrice != null);
  if (!sale.length) return null;
  const row = (v: SaleVariant) => ({
    price: v.price,
    sale_price: v.salePrice,
    sale_starts_at: v.saleStartsAt,
    sale_ends_at: v.saleEndsAt,
  });
  if (sale.some((v) => isSaleActive(row(v), new Date(now)))) return "active";
  if (sale.some((v) => v.saleStartsAt && Date.parse(v.saleStartsAt) > now))
    return "scheduled";
  return "ended";
}

/** Хугацааны текст — хэмжээнүүд ижил хугацаатай байх нь хэвийн тул эхнийхээр. */
function periodOf(p: SaleProduct): string {
  const v = p.variants.find((x) => x.salePrice != null);
  if (!v) return "—";
  if (!v.saleStartsAt && !v.saleEndsAt) return "Хугацаагүй";
  const from = v.saleStartsAt
    ? formatDateTime(v.saleStartsAt).slice(0, 16)
    : "";
  const to = v.saleEndsAt ? formatDateTime(v.saleEndsAt).slice(0, 16) : "…";
  return from ? `${from} → ${to}` : `${to} хүртэл`;
}

type Filter = "all" | "on_sale" | "no_sale";

/**
 * Админ → Каталог → Хямдрал (0166). Бараагаа шүүж сонгоод (бүгд / эрэгтэй /
 * брэнд …) хэмжээ бүрт хувь, хугацаа өгнө — бараа бүрийг нэг бүрчлэн нээх
 * шаардлагагүй. Хямдарсан үнэ нь тухайн хэмжээний үндсэн үнээс бодогдоно.
 */
export function SaleManager({ products }: { products: SaleProduct[] }) {
  const router = useRouter();
  const [now] = React.useState(() => Date.now());

  const [q, setQ] = React.useState("");
  const [gender, setGender] = React.useState<Gender | "all">("all");
  const [brand, setBrand] = React.useState("all");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pcts, setPcts] = React.useState<Record<number, string>>({});
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const brands = React.useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products],
  );

  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (gender !== "all" && p.gender !== gender) return false;
      if (brand !== "all" && p.brand !== brand) return false;
      const onSale = p.variants.some((v) => v.salePrice != null);
      if (filter === "on_sale" && !onSale) return false;
      if (filter === "no_sale" && onSale) return false;
      return !term || `${p.brand} ${p.name}`.toLowerCase().includes(term);
    });
  }, [products, q, gender, brand, filter]);

  const filtersActive =
    q.trim() !== "" || gender !== "all" || brand !== "all" || filter !== "all";

  function resetFilters() {
    setQ("");
    setGender("all");
    setBrand("all");
    setFilter("all");
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allVisibleSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pctValues = Object.fromEntries(
    Object.entries(pcts)
      .map(([ml, raw]) => [ml, Number(raw)] as const)
      .filter(([, n]) => Number.isInteger(n) && n >= 1),
  ) as Record<string, number>;
  const pctError = Object.values(pctValues).some((n) => n > BULK_SALE_MAX_PCT)
    ? `Хувь ${BULK_SALE_MAX_PCT}%-иас ихгүй.`
    : null;
  // Өдрүүд `YYYY-MM-DD` тул мөрөөр харьцуулна. Нэг өдөр эхэлж дуусч болно —
  // дуусах өдөр бүтнээрээ хамрагдана.
  const periodError =
    endsAt && endsAt < ubToday()
      ? "Дуусах өдөр өнгөрсөн байна."
      : startsAt && endsAt && endsAt < startsAt
        ? "Дуусах өдөр эхлэхээс өмнө байж болохгүй."
        : null;
  const canApply =
    selected.size > 0 &&
    Object.keys(pctValues).length > 0 &&
    Boolean(endsAt) &&
    !pctError &&
    !periodError;

  async function apply() {
    setSaving(true);
    const ok = await mutateJson(
      "/api/admin/sales",
      "POST",
      {
        productIds: [...selected],
        pcts: pctValues,
        startsAt: dayStartIso(startsAt),
        endsAt: dayEndIso(endsAt),
      },
      "Хямдрал тавьж чадсангүй",
    );
    setSaving(false);
    if (!ok) return;
    toast.success(`${selected.size} бараанд хямдрал тавигдлаа.`);
    setSelected(new Set());
    router.refresh();
  }

  async function clear() {
    const ok = await mutateJson(
      "/api/admin/sales",
      "DELETE",
      { productIds: [...selected] },
      "Хямдрал цуцалж чадсангүй",
    );
    if (!ok) return;
    toast.success(`${selected.size} барааны хямдрал цуцлагдлаа.`);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ── Хямдрал тавих ─────────────────────────────────────────────── */}
      <section className="bg-card space-y-4 rounded-lg p-4">
        <div>
          <h2 className="font-semibold">Хямдрал тавих</h2>
          <p className="text-muted-foreground text-sm">
            Доорх жагсаалтаас бараагаа сонгоод хэмжээ бүрт хувь оруулна. Хоосон
            хэмжээ өөрчлөгдөхгүй. Хугацаа дуусмагц үнэ өөрөө энгийн болно.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {ML_SIZES.map((ml) => (
            <label key={ml} className="space-y-1 text-xs">
              <span className="text-muted-foreground block">{ml}ml (%)</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={BULK_SALE_MAX_PCT}
                className="h-11 w-24 md:h-9"
                placeholder="—"
                value={pcts[ml] ?? ""}
                onChange={(e) =>
                  setPcts((p) => ({ ...p, [ml]: e.target.value }))
                }
              />
            </label>
          ))}
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground block">Бүх хэмжээнд</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={BULK_SALE_MAX_PCT}
              className="h-11 w-24 md:h-9"
              placeholder="%"
              onChange={(e) =>
                setPcts(
                  Object.fromEntries(
                    ML_SIZES.map((ml) => [ml, e.target.value]),
                  ),
                )
              }
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Эхлэх огноо" className="w-56">
            <DatePicker
              value={startsAt}
              placeholder="Одооноос"
              clearable={false}
              min={ubToday()}
              onChange={setStartsAt}
            />
          </Field>
          <Field label="Дуусах огноо" className="w-56">
            <DatePicker
              value={endsAt}
              placeholder="Огноо сонгох"
              clearable={false}
              // Өнгөрсөн өдөр, эхлэхээс өмнөх өдөр сонгогдохгүй.
              min={startsAt && startsAt > ubToday() ? startsAt : ubToday()}
              onChange={setEndsAt}
            />
          </Field>
          <LoadingButton loading={saving} disabled={!canApply} onClick={apply}>
            Сонгосон {selected.size} бараанд тавих
          </LoadingButton>
        </div>
        {(pctError || periodError) && (
          <p className="text-destructive text-sm">{pctError ?? periodError}</p>
        )}
      </section>

      {/* ── Бараа сонгох ─────────────────────────────────────────────── */}
      <section className="bg-card space-y-3 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Брэнд / нэр"
              className="w-56 pl-9"
            />
          </div>
          <Select
            value={gender}
            onValueChange={(v) => setGender(v as Gender | "all")}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх хүйс</SelectItem>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {GENDER_LABEL[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх брэнд</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх бараа</SelectItem>
              <SelectItem value="on_sale">Хямдралтай</SelectItem>
              <SelectItem value="no_sale">Хямдралгүй</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X />
              Шүүлтүүр цэвэрлэх
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {selected.size} сонгосон
            </span>
            {selected.size > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Сонголт цэвэрлэх
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClear(true)}
                >
                  Хямдрал цуцлах
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-180 text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label="Харагдаж буй бүх барааг сонгох"
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Бүгд ({visible.length})
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Хэмжээ · үнэ
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Хугацаа
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const phase = phaseOf(p, now);
                const isSelected = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className="even:bg-muted/40 cursor-pointer"
                    onClick={() => toggle(p.id)}
                  >
                    <td className="px-3 py-2 align-top">
                      <Checkbox
                        aria-label={`${p.name} сонгох`}
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggle(p.id)}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {p.brand} · {GENDER_LABEL[p.gender]}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                        {p.variants
                          .filter((v) => v.isActive && v.price > 0)
                          .map((v) => {
                            // Сонгосон мөрөнд шинэ үнийг урьдчилан харуулна.
                            const pct = isSelected
                              ? pctValues[String(v.ml)]
                              : undefined;
                            const next =
                              pct && pct <= BULK_SALE_MAX_PCT
                                ? bulkSalePrice(v.price, pct)
                                : v.salePrice;
                            return (
                              <span key={v.ml}>
                                <span className="text-muted-foreground">
                                  {v.ml}ml{" "}
                                </span>
                                {next != null && next < v.price ? (
                                  <>
                                    <span className="text-muted-foreground line-through">
                                      {formatPrice(v.price)}
                                    </span>{" "}
                                    <span
                                      className={
                                        pct
                                          ? "text-primary font-semibold"
                                          : "text-destructive font-medium"
                                      }
                                    >
                                      {formatPrice(next)}
                                    </span>
                                  </>
                                ) : (
                                  formatPrice(v.price)
                                )}
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {phase ? (
                        <div className="space-y-1">
                          <Badge
                            variant={phase === "active" ? "sale" : "secondary"}
                          >
                            {PHASE_LABEL[phase]}
                          </Badge>
                          <div className="text-muted-foreground tabular-nums">
                            {periodOf(p)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Хямдрал цуцлах уу?"
        description={`Сонгосон ${selected.size} барааны бүх хэмжээний хямдрал, хугацаа арилж энгийн үнэ рүүгээ буцна.`}
        confirmLabel="Цуцлах"
        destructive
        onConfirm={clear}
      />
    </div>
  );
}
