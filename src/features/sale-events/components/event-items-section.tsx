"use client";

import * as React from "react";
import { Check, Plus, Search, X } from "lucide-react";
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
 * Бараа + хувь (plan §9.1-2, studio-ux.md §5.2). Зүүн — «Бараа нэмэх»: хайж
 * сонгоод (хүсвэл хэмжээ бүрд хувь өгч) нэг товчоор нэмнэ; өөр бүлэгт өөр
 * хувь өгч давтана. Баруун — «Хямдрах бараа»: бараа бүрийн хувийг шууд засна,
 * шинэ үнэ дор нь харагдана. Утсан дээр сонгосон бараа эхэндээ.
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

  /**
   * Сонгосон барааг нэмнэ. Хувь бичсэн бол сонгосон бүх бараанд (аль хэдийн
   * нэмсэн ч) тэр хувийг сольж бичнэ; бичээгүй бол шинийг хувьгүй нэмж,
   * нэмсэн барааны хувийг хөндөхгүй.
   */
  function apply() {
    const filled = Object.fromEntries(
      Object.entries(pcts).filter(([, v]) => v.trim() !== ""),
    ) as Record<number, string>;
    const withPcts = Object.keys(filled).length > 0;
    const items = [...members];
    for (const id of selected) {
      const at = items.findIndex((i) => i.productId === id);
      if (at >= 0) {
        if (withPcts) items[at] = { productId: id, pcts: { ...filled } };
      } else {
        items.push({ productId: id, pcts: withPcts ? { ...filled } : {} });
      }
    }
    onChange(items);
    setSelected(new Set());
    setPcts({});
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

  const hasSelection = selected.size > 0;
  // Хувьгүй нэмэхэд зөвхөн шинэ бараа нэмэгдэнэ (нэмсэний хувь хөндөгдөхгүй).
  const newCount = [...selected].filter((id) => !memberIds.has(id)).length;
  // «Бүгдэд» — бүх хэмжээ ижил үед тэр утгыг харуулна.
  const firstPct = pcts[ML_SIZES[0]] ?? "";
  const allPct = ML_SIZES.every((ml) => (pcts[ml] ?? "") === firstPct)
    ? firstPct
    : "";

  return (
    <section className="grid items-start gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Арга хэмжээний бараа ──────────────────────────────────── */}
      <div className="min-w-0 space-y-4 lg:order-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-xl font-semibold">
            Хямдрах бараа{" "}
            <span className="text-muted-foreground font-sans text-base font-normal tabular-nums">
              {members.length}
            </span>
          </h3>
          {members.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onChange([])}
            >
              Бүгдийг хасах
            </Button>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {members.length === 0 ? (
          <div className="bg-secondary/50 text-muted-foreground rounded-2xl px-6 py-12 text-center text-sm text-pretty">
            Одоохондоо хоосон.
            <br />
            <span className="lg:hidden">Доорх</span>
            <span className="hidden lg:inline">Зүүн талын</span> жагсаалтаас
            бараагаа сонгож нэмнэ үү.
          </div>
        ) : (
          <ul role="list" className="space-y-3">
            {members.map((item) => {
              const p = byId.get(item.productId);
              const conflict = conflictIds.has(item.productId);
              const sizes = ML_SIZES.filter((ml) => p?.prices[ml] != null);
              // Сонгосон бараа бүр дор хаяж нэг хэмжээнд хямдрах ёстой.
              const noPct = Object.values(item.pcts).every(
                (v) => v.trim() === "",
              );
              return (
                <li
                  key={item.productId}
                  className={cn(
                    "space-y-4 rounded-2xl p-4",
                    conflict ? "bg-destructive/10" : "bg-secondary/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
                        {p?.brand ?? "—"}
                      </p>
                      <p className="truncate font-medium">
                        {p?.name ?? "Нуусан / устгасан бараа"}
                      </p>
                      {conflict && (
                        <p className="text-destructive mt-1 text-xs">
                          Өөр арга хэмжээнд давхацсан
                        </p>
                      )}
                      {noPct && (
                        <p className="text-destructive mt-1 text-xs">
                          Дор хаяж нэг хэмжээнд хувь бичнэ үү
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground -mt-1 -mr-1 size-9 shrink-0 rounded-full"
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
                    {sizes.map((ml) => {
                      const base = p?.prices[ml] ?? 0;
                      const raw = item.pcts[ml] ?? "";
                      const n = Number(raw);
                      const valid =
                        raw.trim() !== "" &&
                        Number.isInteger(n) &&
                        n >= 1 &&
                        n <= SALE_EVENT_MAX_PCT;
                      return (
                        <label key={ml} className="block space-y-1.5">
                          <span className="text-muted-foreground block text-xs font-medium">
                            {ml}ml
                          </span>
                          <PctInput
                            value={raw}
                            invalid={raw.trim() !== "" && !valid}
                            aria-label={`${p?.name ?? ""} ${ml}ml хувь`}
                            onChange={(v) => setItemPct(item.productId, ml, v)}
                          />
                          <span className="flex flex-col text-xs tabular-nums">
                            {valid ? (
                              <>
                                <span className="font-medium">
                                  {formatPrice(bulkSalePrice(base, n))}
                                </span>
                                <span className="text-muted-foreground line-through">
                                  {formatPrice(base)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {formatPrice(base)}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Бараа нэмэх ───────────────────────────────────────────── */}
      <div className="min-w-0 space-y-4 lg:order-1">
        <h3 className="font-serif text-xl font-semibold">Бараа нэмэх</h3>

        <div className="space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Брэнд эсвэл нэрээр хайх"
              className="h-12 rounded-xl pl-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={gender}
              onValueChange={(v) => setGender(v as Gender | "all")}
            >
              <SelectTrigger className="h-11 rounded-xl">
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
              <SelectTrigger className="h-11 rounded-xl">
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
        </div>

        <div className="bg-secondary/50 overflow-hidden rounded-2xl">
          <label className="text-muted-foreground flex cursor-pointer items-center gap-3 px-4 pt-3 pb-2 text-xs">
            <Checkbox
              aria-label="Харагдаж буй бүх барааг сонгох"
              checked={allVisibleSelected}
              onCheckedChange={toggleAll}
            />
            <span className="tabular-nums">
              Бүгдийг сонгох · {visible.length} бараа
            </span>
          </label>
          <ul
            role="list"
            className="max-h-80 overflow-y-auto px-1.5 pb-1.5 lg:max-h-112"
          >
            {visible.length === 0 && (
              <li className="text-muted-foreground px-3 py-8 text-center text-sm">
                Илэрц олдсонгүй
              </li>
            )}
            {visible.map((p) => {
              const isOn = selected.has(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl p-2.5 text-sm",
                      isOn ? "bg-background" : "hover:bg-background/60",
                    )}
                  >
                    <Checkbox
                      checked={isOn}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground"> · {p.brand}</span>
                    </span>
                    {memberIds.has(p.id) && (
                      <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
                        <Check className="size-3.5" />
                        Нэмсэн
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {hasSelection && (
          <div className="bg-foreground text-background space-y-4 rounded-2xl p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium tabular-nums">
                {selected.size} бараа сонгосон
              </p>
              <button
                type="button"
                className="text-sm opacity-70 hover:opacity-100"
                onClick={() => setSelected(new Set())}
              >
                Цуцлах
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm opacity-70">
                Хямдралын хувь — хоосон хэмжээ хямдрахгүй
              </p>
              <div className="grid grid-cols-5 gap-2">
                {ML_SIZES.map((ml) => (
                  <label key={ml} className="block space-y-1">
                    <span className="block text-xs opacity-70">{ml}ml</span>
                    <PctInput
                      tone="inverse"
                      value={pcts[ml] ?? ""}
                      onChange={(v) => setPcts((x) => ({ ...x, [ml]: v }))}
                    />
                  </label>
                ))}
                <label className="block space-y-1">
                  <span className="block text-xs opacity-70">Бүгдэд</span>
                  <PctInput
                    tone="inverse"
                    value={allPct}
                    placeholder="%"
                    onChange={(v) =>
                      setPcts(Object.fromEntries(ML_SIZES.map((ml) => [ml, v])))
                    }
                  />
                </label>
              </div>
              {pctError && (
                <p className="text-background text-xs font-medium" role="alert">
                  ⚠ {pctError}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="w-full"
              disabled={
                !!pctError || (pctValues.length === 0 && newCount === 0)
              }
              onClick={apply}
            >
              <Plus />
              {pctValues.length > 0
                ? `${selected.size} бараанд хувь хэрэглэх`
                : newCount === 0
                  ? "Аль хэдийн нэмсэн — хувь бичнэ үү"
                  : `${newCount} барааг хувьгүй нэмэх`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** «%» дагавартай, хүрээгүй хувийн талбар. */
function PctInput({
  value,
  onChange,
  invalid,
  placeholder = "—",
  tone = "default",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  tone?: "default" | "inverse";
  "aria-label"?: string;
}) {
  return (
    <span className="relative block">
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={SALE_EVENT_MAX_PCT}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 rounded-lg pr-7 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          tone === "inverse"
            ? "bg-background/15 placeholder:text-background/50 text-background"
            : "bg-background",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs",
          tone === "inverse" ? "text-background/60" : "text-muted-foreground",
        )}
      >
        %
      </span>
    </span>
  );
}
