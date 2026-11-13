"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENDERS,
  GENDER_LABEL,
  ML_SIZES,
  SALE_EVENT_MAX_PCT,
} from "@/lib/constants";
import type { Gender } from "@/db/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bulkSalePrice } from "@/lib/validators/sale";
import type { SaleEventProduct } from "../types";
import type { StudioItem } from "./studio/studio-model";

/**
 * Бараа + хувь (plan §9.1-2, studio-ux.md §5.2): одоогийн «Хямдрал» хуудасны
 * урсгалтай ижил — бараагаа шүүж сонгоод хэмжээ бүрд хувь өгч «Хэрэглэх»;
 * өөр бүлэгт өөр хувь өгч давтана. Баруун талд бараа бүрийн хувийг шууд
 * засна. Студийн ②-р алхам: ≥lg хоёр багана (зүүн — сонгогч, баруун —
 * сонгосон бараа), доош нь нэг.
 */
export function EventItemsSection({
  items: members,
  products,
  byId,
  conflictIds,
  error,
  onChange,
}: {
  items: StudioItem[];
  products: SaleEventProduct[];
  byId: Map<string, SaleEventProduct>;
  conflictIds: Set<string>;
  error?: string;
  onChange: (items: StudioItem[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const [gender, setGender] = React.useState<Gender | "all">("all");
  const [brand, setBrand] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pcts, setPcts] = React.useState<Record<number, string>>({});

  const brands = React.useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products],
  );
  const memberIds = new Set(members.map((i) => i.productId));
  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (gender === "all" || p.gender === gender) &&
        (brand === "all" || p.brand === brand) &&
        (!term || `${p.brand} ${p.name}`.toLowerCase().includes(term)),
    );
  }, [products, q, gender, brand]);
  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  /** Сонгосон бараануудыг нэмнэ / хувийг нь сольж бичнэ. */
  function apply(withPcts: boolean) {
    const filled = Object.fromEntries(
      Object.entries(pcts).filter(([, v]) => v.trim() !== ""),
    ) as Record<number, string>;
    const items = [...members];
    for (const id of selected) {
      const at = items.findIndex((i) => i.productId === id);
      const next = { productId: id, pcts: withPcts ? { ...filled } : {} };
      if (at >= 0) items[at] = next;
      else items.push(next);
    }
    onChange(items);
    setSelected(new Set());
  }

  function setItemPct(productId: string, ml: number, value: string) {
    onChange(
      members.map((i) =>
        i.productId === productId
          ? { ...i, pcts: { ...i.pcts, [ml]: value } }
          : i,
      ),
    );
  }

  const pctValues = Object.values(pcts).filter((v) => v.trim() !== "");
  const pctError = pctValues.some((v) => {
    const n = Number(v);
    return !Number.isInteger(n) || n < 1 || n > SALE_EVENT_MAX_PCT;
  })
    ? `Хувь 1–${SALE_EVENT_MAX_PCT} бүхэл тоо.`
    : null;

  return (
    <section className="grid items-start gap-6 lg:grid-cols-2">
      {/* ── 1. Сонгох ──────────────────────────────────────────────── */}
      <div className="bg-secondary/60 min-w-0 space-y-3 rounded-lg p-3">
        <div>
          <h3 className="text-sm font-semibold">Бараа сонгох</h3>
          <p className="text-muted-foreground text-xs">
            Бараагаа сонгоод хэмжээ бүрд хувь өгч «Хэрэглэх». Өөр бүлэгт өөр
            хувь өгч давтана. Хоосон хэмжээ хямдрахгүй. Хувь нь үндсэн үнээс,
            100₮-д дугуйрна.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {ML_SIZES.map((ml) => (
            <label key={ml} className="space-y-1 text-xs">
              <span className="text-muted-foreground block">{ml}ml (%)</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={SALE_EVENT_MAX_PCT}
                className="h-11 w-20 md:h-9"
                placeholder="—"
                value={pcts[ml] ?? ""}
                onChange={(e) =>
                  setPcts((p) => ({ ...p, [ml]: e.target.value }))
                }
              />
            </label>
          ))}
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground block">Бүгдэд</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={SALE_EVENT_MAX_PCT}
              className="h-11 w-20 md:h-9"
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
        {pctError && <p className="text-destructive text-xs">{pctError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={selected.size === 0 || pctValues.length === 0 || !!pctError}
            onClick={() => apply(true)}
          >
            Сонгосон {selected.size} бараанд хэрэглэх
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => apply(false)}
          >
            Хувьгүй нэмэх
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Брэнд / нэр"
              className="pl-9"
            />
          </div>
          <Select
            value={gender}
            onValueChange={(v) => setGender(v as Gender | "all")}
          >
            <SelectTrigger className="w-32">
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
            <SelectTrigger className="w-40">
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
        </div>

        <ul
          role="list"
          className="bg-card divide-border max-h-72 divide-y overflow-y-auto lg:max-h-128 rounded-md"
        >
          <li className="flex items-center gap-3 px-3 py-2 text-xs">
            <Checkbox
              aria-label="Харагдаж буй бүх барааг сонгох"
              checked={allVisibleSelected}
              onCheckedChange={toggleAll}
            />
            <span className="text-muted-foreground">
              Бүгд ({visible.length}) · {selected.size} сонгосон
            </span>
          </li>
          {visible.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    {p.brand}
                  </span>
                </span>
                {memberIds.has(p.id) && (
                  <Badge variant="secondary" className="shrink-0">
                    Нэмсэн
                  </Badge>
                )}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* ── 2. Арга хэмжээний бараа ───────────────────────────────── */}
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Арга хэмжээнд ({members.length})
          </h3>
          {members.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
            >
              Бүгдийг хасах
            </Button>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {members.length === 0 ? (
          <p className="text-muted-foreground bg-secondary/40 rounded-md p-4 text-center text-sm">
            Жагсаалтаас бараа сонгож нэмнэ үү.
          </p>
        ) : (
          <ul role="list" className="space-y-2">
            {members.map((item) => {
              const p = byId.get(item.productId);
              const conflict = conflictIds.has(item.productId);
              return (
                <li
                  key={item.productId}
                  className={cn(
                    "bg-card space-y-2 rounded-md p-3",
                    conflict && "ring-destructive ring-2",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">
                        {p?.name ?? "Нуусан / устгасан бараа"}
                      </span>{" "}
                      <span className="text-muted-foreground text-xs">
                        {p?.brand}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`${p?.name ?? "Бараа"}-г хасах`}
                      onClick={() =>
                        onChange(
                          members.filter(
                            (i) => i.productId !== item.productId,
                          ),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ML_SIZES.filter((ml) => p?.prices[ml] != null).map(
                      (ml) => {
                        const base = p?.prices[ml] ?? 0;
                        const raw = item.pcts[ml] ?? "";
                        const n = Number(raw);
                        const valid =
                          raw.trim() !== "" &&
                          Number.isInteger(n) &&
                          n >= 1 &&
                          n <= SALE_EVENT_MAX_PCT;
                        return (
                          <label key={ml} className="space-y-1 text-xs">
                            <span className="text-muted-foreground flex items-center justify-between gap-1">
                              <span>{ml}ml</span>
                              <span className="tabular-nums">
                                {valid ? (
                                  <>
                                    <span className="line-through">
                                      {formatPrice(base)}
                                    </span>{" "}
                                    <span className="text-foreground font-medium">
                                      {formatPrice(bulkSalePrice(base, n))}
                                    </span>
                                  </>
                                ) : (
                                  formatPrice(base)
                                )}
                              </span>
                            </span>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={SALE_EVENT_MAX_PCT}
                              placeholder="—"
                              aria-label={`${p?.name ?? ""} ${ml}ml хувь`}
                              className={cn(
                                "h-11 md:h-9",
                                raw.trim() !== "" &&
                                  !valid &&
                                  "field-edge-error",
                              )}
                              value={raw}
                              onChange={(e) =>
                                setItemPct(item.productId, ml, e.target.value)
                              }
                            />
                          </label>
                        );
                      },
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
