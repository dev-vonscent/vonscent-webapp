"use client";

import * as React from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/shared/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

function validPct(raw: string): boolean {
  const n = Number(raw);
  return (
    raw.trim() !== "" &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= SALE_EVENT_MAX_PCT
  );
}

/** Хүснэгтийн багана: бараа · 4 хэмжээ · хасах. */
const GRID =
  "grid grid-cols-[minmax(9rem,1fr)_repeat(4,minmax(5.75rem,7.5rem))_2.25rem] items-center gap-x-2";

/**
 * Бараа + хувь (plan §9.1-2, studio-ux.md §5.2). Хуудсан дээр зөвхөн
 * хямдрах барааны нягт хүснэгт: мөр = бараа, багана = хэмжээ, нүд бүрт хувь,
 * доор нь шинэ үнэ. Баганын толгойн «бүгдэд» талбар тэр хэмжээний бүх мөрийг
 * нэг дор бөглөнө. Шинэ бараа — «Бараа нэмэх» sheet (хайх, шүүх, олноор сонгож
 * хувьтай/хувьгүй нэмэх).
 */
export function EventItemsSection({
  items: members,
  products,
  byId,
  conflictIds,
  error,
  summary,
  onChange,
}: {
  items: StudioItem[];
  products: SaleEventProduct[];
  byId: Map<string, SaleEventProduct>;
  conflictIds: Set<string>;
  error?: string;
  /** Хүснэгтийн дээрх тойм («5 бараа сонгосон · хямдрал 10–30%»). */
  summary?: React.ReactNode;
  onChange: (items: StudioItem[]) => void;
}) {
  const [adding, setAdding] = React.useState(false);

  function setItemPct(productId: string, ml: number, value: string) {
    onChange(
      members.map((i) =>
        i.productId === productId
          ? { ...i, pcts: { ...i.pcts, [ml]: value } }
          : i,
      ),
    );
  }

  /** Баганын нийтлэг утга — бүх (тэр хэмжээтэй) мөр ижил бол түүнийг. */
  function columnValue(ml: number): string {
    const values = members
      .filter((i) => byId.get(i.productId)?.prices[ml] != null)
      .map((i) => i.pcts[ml] ?? "");
    if (values.length === 0) return "";
    return values.every((v) => v === values[0]) ? values[0] : "";
  }

  function setColumn(ml: number, value: string) {
    onChange(
      members.map((i) =>
        byId.get(i.productId)?.prices[ml] != null
          ? { ...i, pcts: { ...i.pcts, [ml]: value } }
          : i,
      ),
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-60">{summary}</div>
        {members.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onChange([])}
          >
            Бүгдийг хасах
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
        >
          <Plus />
          Бараа нэмэх
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {members.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm text-pretty">
            Хямдрах бараа хараахан сонгоогүй байна.
          </p>
          <Button
            type="button"
            className="bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={() => setAdding(true)}
          >
            <Plus />
            Бараа нэмэх
          </Button>
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg">
          <div
            role="table"
            aria-label="Хямдрах бараа"
            className="min-w-152 p-1.5"
          >
            <div
              role="row"
              className={cn(
                GRID,
                "text-muted-foreground bg-secondary/50 rounded-md px-2.5 py-2 text-xs",
              )}
            >
              <span role="columnheader" className="font-medium">
                Бараа <span className="tabular-nums">· {members.length}</span>
              </span>
              {ML_SIZES.map((ml) => (
                <span role="columnheader" key={ml} className="space-y-1">
                  <span className="block font-medium">{ml}ml</span>
                  <Tooltip
                    content={`${ml}ml-ийн бүх бараанд нэг дор хувь өгнө`}
                    className="w-full"
                  >
                    <span className="block w-full">
                      <PctInput
                        size="sm"
                        value={columnValue(ml)}
                        placeholder="бүгд"
                        aria-label={`${ml}ml — бүх бараанд хувь`}
                        onChange={(v) => setColumn(ml, v)}
                      />
                    </span>
                  </Tooltip>
                </span>
              ))}
              <span role="columnheader" className="sr-only">
                Хасах
              </span>
            </div>

            <div role="rowgroup">
              {members.map((item) => {
                const p = byId.get(item.productId);
                const conflict = conflictIds.has(item.productId);
                const noPct = Object.values(item.pcts).every(
                  (v) => v.trim() === "",
                );
                return (
                  <div
                    role="row"
                    key={item.productId}
                    className={cn(
                      GRID,
                      "rounded-md px-2.5 py-2",
                      conflict ? "bg-destructive/10" : "hover:bg-secondary/40",
                    )}
                  >
                    <div role="cell" className="min-w-0">
                      <p className="text-muted-foreground truncate text-[11px] tracking-[0.12em] uppercase">
                        {p?.brand ?? "—"}
                      </p>
                      <p className="truncate text-sm font-medium">
                        {p?.name ?? "Нуусан / устгасан бараа"}
                      </p>
                      {(conflict || noPct) && (
                        <p className="text-destructive truncate text-xs">
                          {conflict
                            ? "Өөр арга хэмжээнд давхацсан"
                            : "Дор хаяж нэг хэмжээнд хувь бичнэ үү"}
                        </p>
                      )}
                    </div>
                    {ML_SIZES.map((ml) => {
                      const base = p?.prices[ml];
                      if (base == null) {
                        return (
                          <span
                            role="cell"
                            key={ml}
                            className="text-muted-foreground/60 pl-3 text-sm"
                            aria-label={`${ml}ml байхгүй`}
                          >
                            —
                          </span>
                        );
                      }
                      const raw = item.pcts[ml] ?? "";
                      const valid = validPct(raw);
                      return (
                        <div role="cell" key={ml} className="space-y-1">
                          <PctInput
                            value={raw}
                            invalid={raw.trim() !== "" && !valid}
                            aria-label={`${p?.name ?? ""} ${ml}ml хувь`}
                            onChange={(v) => setItemPct(item.productId, ml, v)}
                          />
                          <p className="truncate text-[11px] leading-tight tabular-nums">
                            {valid ? (
                              <>
                                <span className="font-medium">
                                  {formatPrice(
                                    bulkSalePrice(base, Number(raw)),
                                  )}
                                </span>{" "}
                                <span className="text-muted-foreground line-through">
                                  {formatPrice(base)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {formatPrice(base)}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                    <div role="cell">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-9 rounded-full"
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AddProductsSheet
        open={adding}
        onOpenChange={setAdding}
        products={products}
        members={members}
        onChange={onChange}
      />
    </section>
  );
}

/**
 * «Бараа нэмэх» sheet: хайх, хүйс/брэндээр шүүх, олноор сонгоно. Хувь бичвэл
 * сонгосон бүх бараанд (нэмсэн ч) тэр хувийг сольж бичнэ; бичээгүй бол
 * шинийг хувьгүй нэмж, нэмсэн барааны хувийг хөндөхгүй.
 */
function AddProductsSheet({
  open,
  onOpenChange,
  products,
  members,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: SaleEventProduct[];
  members: StudioItem[];
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
    onOpenChange(false);
  }

  const pctValues = Object.values(pcts).filter((v) => v.trim() !== "");
  const pctError = pctValues.some((v) => !validPct(v))
    ? `Хувь 1–${SALE_EVENT_MAX_PCT} бүхэл тоо.`
    : null;
  const hasSelection = selected.size > 0;
  const newCount = [...selected].filter((id) => !memberIds.has(id)).length;
  const firstPct = pcts[ML_SIZES[0]] ?? "";
  const allPct = ML_SIZES.every((ml) => (pcts[ml] ?? "") === firstPct)
    ? firstPct
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 [--input-edge:transparent] sm:max-w-lg"
      >
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle>Бараа нэмэх</SheetTitle>
          <SheetDescription>
            Сонгоод доор хувиа бичнэ. Хоосон хэмжээ хямдрахгүй.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-5 pb-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Брэнд эсвэл нэрээр хайх"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={gender}
              onValueChange={(v) => setGender(v as Gender | "all")}
            >
              <SelectTrigger>
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
              <SelectTrigger>
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

        <label className="text-muted-foreground flex cursor-pointer items-center gap-3 px-6 py-2 text-xs">
          <Checkbox
            aria-label="Харагдаж буй бүх барааг сонгох"
            checked={allVisibleSelected}
            onCheckedChange={toggleAll}
          />
          <span className="tabular-nums">
            Бүгдийг сонгох · {visible.length} бараа
          </span>
        </label>
        <ul role="list" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
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
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                    isOn ? "bg-secondary" : "hover:bg-secondary/50",
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

        <div className="bg-secondary/50 space-y-3 px-5 py-4">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <p className="font-medium tabular-nums">
              {hasSelection
                ? `${selected.size} бараа сонгосон`
                : "Бараа сонгоогүй"}
            </p>
            {hasSelection && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(new Set())}
              >
                Цуцлах
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {ML_SIZES.map((ml) => (
              <label key={ml} className="block space-y-1">
                <span className="text-muted-foreground block text-xs">
                  {ml}ml
                </span>
                <PctInput
                  value={pcts[ml] ?? ""}
                  onChange={(v) => setPcts((x) => ({ ...x, [ml]: v }))}
                />
              </label>
            ))}
            <label className="block space-y-1">
              <span className="text-muted-foreground block text-xs">
                Бүгдэд
              </span>
              <PctInput
                value={allPct}
                placeholder="%"
                onChange={(v) =>
                  setPcts(Object.fromEntries(ML_SIZES.map((ml) => [ml, v])))
                }
              />
            </label>
          </div>
          {pctError && (
            <p className="text-destructive text-xs font-medium" role="alert">
              {pctError}
            </p>
          )}
          <Button
            type="button"
            className="bg-cta text-cta-foreground hover:bg-cta/90 w-full"
            disabled={
              !hasSelection ||
              !!pctError ||
              (pctValues.length === 0 && newCount === 0)
            }
            onClick={apply}
          >
            <Plus />
            {!hasSelection
              ? "Бараа сонгоно уу"
              : pctValues.length > 0
                ? `${selected.size} бараанд хувь хэрэглэх`
                : newCount === 0
                  ? "Аль хэдийн нэмсэн — хувь бичнэ үү"
                  : `${newCount} барааг хувьгүй нэмэх`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** «%» дагавартай хувийн талбар. */
export function PctInput({
  value,
  onChange,
  invalid,
  placeholder = "—",
  size = "default",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  size?: "default" | "sm";
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
          "bg-background [appearance:textfield] pr-6 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          size === "sm" && "h-8 text-xs md:text-xs",
          invalid && "field-edge-error",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs"
      >
        %
      </span>
    </span>
  );
}
