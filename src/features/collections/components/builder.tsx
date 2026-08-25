"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { BUNDLE_ML_SIZES } from "@/lib/constants";
import { useCart } from "@/features/cart/store";
import { CatalogFilters } from "@/features/catalog/components/catalog-filters";
import { CatalogFilterSheet } from "@/features/catalog/components/catalog-filter-sheet";
import { CatalogSort } from "@/features/catalog/components/catalog-sort";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { parseFilters } from "@/features/catalog/parse";
import { bundlePrice } from "../pricing";
import { GiftPicker } from "./gift-picker";
import type {
  BuilderProduct,
  CollectionSettings,
  GiftCandidate,
} from "../types";
import type { CatalogFilters as Filters, ScentFamilyOption } from "@/lib/types";

/** Filter + sort a product list the same way the catalog server does. */
function applyFilters(
  products: BuilderProduct[],
  f: Filters,
): BuilderProduct[] {
  const items = products.filter((p) => {
    if (f.brand?.length && !f.brand.includes(p.brand)) return false;
    if (f.gender?.length && !f.gender.includes(p.gender)) return false;
    if (f.family?.length && !f.family.some((x) => p.scentFamilies.includes(x)))
      return false;
    if (
      f.season?.length &&
      !(
        p.seasons.includes("all") || f.season.some((s) => p.seasons.includes(s))
      )
    )
      return false;
    if (f.tags?.length && !f.tags.some((t) => p.tags.includes(t))) return false;
    if (f.minPrice != null && p.startingPrice < f.minPrice) return false;
    if (f.maxPrice != null && p.startingPrice > f.maxPrice) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!`${p.name} ${p.brand}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const sort = f.sort ?? "new";
  return [...items].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.startingPrice - b.startingPrice;
      case "price_desc":
        return b.startingPrice - a.startingPrice;
      case "name":
        return a.name.localeCompare(b.name);
      case "popular":
        return b.ratingCount - a.ratingCount;
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
}

export function CollectionBuilder({
  products,
  settings,
  isLoggedIn,
  brands,
  priceBounds,
  families,
}: {
  products: BuilderProduct[];
  settings: CollectionSettings;
  isLoggedIn: boolean;
  brands: string[];
  priceBounds: { min: number; max: number };
  families: ScentFamilyOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addCollection = useCart((s) => s.addCollection);

  const [ml, setMl] = React.useState<number>(BUNDLE_ML_SIZES[0]);
  const [ids, setIds] = React.useState<string[]>([]);
  const [giftId, setGiftId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [save, setSave] = React.useState(isLoggedIn);
  const [busy, setBusy] = React.useState(false);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.productId, p])),
    [products],
  );

  const filters = React.useMemo(
    () => parseFilters(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );

  // Show every product the filters match — a scent the customer searched for
  // must never just vanish. Ones the chosen size can't fill are shown disabled
  // with an explanation rather than hidden (avoids "where did it go?").
  const grid = React.useMemo(
    () => applyFilters(products, filters),
    [products, filters],
  );

  const selected = ids
    .map((id) => byId.get(id))
    .filter(Boolean) as BuilderProduct[];
  // A size change never silently drops a pick: unavailable members stay
  // selected but are flagged so the customer sees exactly what's affected.
  const availableSelected = selected.filter((p) => p.variantByMl[ml]?.inStock);
  const unavailableSelected = selected.filter(
    (p) => !p.variantByMl[ml]?.inStock,
  );
  const memberSum = availableSelected.reduce(
    (sum, p) => sum + (p.variantByMl[ml]?.price ?? 0),
    0,
  );
  const price = bundlePrice(
    memberSum,
    settings.customDiscountPct,
    settings.roundTo,
  );
  const saved = memberSum - price;

  const giftCandidates: GiftCandidate[] = React.useMemo(
    () =>
      products
        .filter(
          (p) =>
            !ids.includes(p.productId) &&
            !p.soldOut &&
            p.availableMl >= settings.giftMl,
        )
        .map((p) => ({
          productId: p.productId,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          image: p.image,
        })),
    [products, ids, settings.giftMl],
  );

  const atMax = settings.maxItems != null && ids.length >= settings.maxItems;
  const needsGift =
    settings.giftEnabled && giftCandidates.length > 0 && !giftId;
  const canCreate =
    unavailableSelected.length === 0 &&
    ids.length >= settings.minItems &&
    !needsGift;

  function changeMl(next: number) {
    setMl(next);
  }

  function removeUnavailable() {
    const bad = new Set(unavailableSelected.map((p) => p.productId));
    setIds((prev) => prev.filter((id) => !bad.has(id)));
    if (giftId && bad.has(giftId)) setGiftId(null);
  }

  function toggle(id: string) {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (settings.maxItems != null && prev.length >= settings.maxItems)
        return prev;
      return [...prev, id];
    });
    if (giftId === id) setGiftId(null);
  }

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    const gift = giftCandidates.find((g) => g.productId === giftId) ?? null;
    const first = availableSelected[0];

    addCollection({
      collectionId: null,
      type: "custom",
      slug: "custom",
      name: name.trim() || "Миний багц",
      image: first?.image?.url ?? null,
      discountPct: settings.customDiscountPct,
      ml,
      members: availableSelected.map((p) => ({
        productId: p.productId,
        variantId: p.variantByMl[ml].variantId,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        image: p.image?.url ?? null,
        price: p.variantByMl[ml].price,
      })),
      gift: gift
        ? {
            productId: gift.productId,
            name: gift.name,
            brand: gift.brand,
            image: gift.image?.url ?? null,
            ml: settings.giftMl,
          }
        : null,
      unitPrice: price,
    });

    if (save && isLoggedIn && name.trim()) {
      await fetch("/api/collections/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          gender: "unisex",
          productIds: ids,
        }),
      }).catch(() => {});
    }

    setBusy(false);
    setOpen(false);
    setIds([]);
    setGiftId(null);
    setName("");
    setDesc("");
    router.refresh();
  }

  // Selection tray — rendered inside the product column so on desktop it sits
  // above the product list only, not over the filter sidebar. Sticky so it
  // rides up under the header on scroll.
  const tray = (
    <div className="sticky top-(--header-offset) z-30 mb-4 transition-[top] duration-300 ease-out">
      <div className="border-border from-card/95 to-card/90 shadow-lift rounded-2xl border bg-linear-to-b p-3 backdrop-blur sm:p-4">
        {/* Header — bundle size (left) + running count / price (right) */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="mb-2 flex w-full items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              Хэмжээ
            </span>
            <div className="bg-secondary flex items-center gap-0.5 rounded-full p-0.5">
              {BUNDLE_ML_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => changeMl(size)}
                  aria-pressed={size === ml}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    size === ml
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {size}ml
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-muted-foreground text-xs">
              <span className="text-foreground font-semibold">
                {availableSelected.length}
              </span>
              /{settings.minItems}
              {settings.maxItems ? `–${settings.maxItems}` : "+"} үнэртэн
            </span>
            {price > 0 && (
              <span className="font-serif text-lg leading-none font-semibold">
                {formatPrice(price)}
              </span>
            )}
            {saved > 0 && (
              <span className="text-gold-strong text-xs font-medium">
                −{formatPrice(saved)}
              </span>
            )}
          </div>
        </div>

        {/* Selected scents — its own full-width row of larger thumbnails */}
        <div className="mt-3">
          {selected.length === 0 ? (
            <div className="border-border text-muted-foreground flex h-16 items-center justify-center rounded-xl border border-dashed px-3 text-center text-sm">
              Доорх үнэртнүүдээс {settings.minItems}+ сонгож багцаа
              бүрдүүлээрэй.
            </div>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {selected.map((p) => {
                const bad = !p.variantByMl[ml]?.inStock;
                return (
                  <button
                    key={p.productId}
                    onClick={() => toggle(p.productId)}
                    aria-label={`${p.brand} ${p.name} хасах`}
                    title={
                      bad
                        ? `${p.brand} — ${p.name}: ${ml}ml-д байхгүй`
                        : `${p.brand} — ${p.name}`
                    }
                    className={cn(
                      "bg-muted group relative size-16 shrink-0 overflow-hidden rounded-xl border transition-transform hover:-translate-y-0.5",
                      bad
                        ? "border-destructive ring-destructive/50 ring-2"
                        : "border-border",
                    )}
                  >
                    {p.image && (
                      <Image
                        src={p.image.url}
                        alt={p.name}
                        fill
                        sizes="64px"
                        className={cn(
                          "object-cover",
                          bad && "opacity-40 grayscale",
                        )}
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                      <X className="size-5 text-white" />
                    </span>
                    {bad && (
                      <span className="bg-destructive absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-semibold text-white">
                        байхгүй
                      </span>
                  )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions — gift picker + create; stacks on mobile */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          {settings.giftEnabled && giftCandidates.length > 0 && (
            <div className="min-w-0 flex-1">
              <GiftPicker
                candidates={giftCandidates}
                giftMl={settings.giftMl}
                value={giftId}
                onChange={setGiftId}
              />
            </div>
          )}
          <Button
            disabled={!canCreate}
            onClick={() => {
              setName("");
              setDesc("");
              setOpen(true);
            }}
            className="w-full shrink-0 sm:ml-auto sm:w-auto"
          >
            <Sparkles className="size-4" />
            {unavailableSelected.length > 0
              ? `${unavailableSelected.length} үнэртэн ${ml}ml-д байхгүй`
              : "Багц үүсгэх"}
          </Button>
        </div>

        {/* Nothing is dropped silently — name the affected scents and why,
              and let the customer clear them in one tap. */}
        {unavailableSelected.length > 0 && (
          <div className="bg-destructive/10 text-destructive mt-2 rounded-lg px-3 py-2 text-xs">
            <p className="font-medium">
              Эдгээр үнэртэн {ml}ml хэмжээгээр одоогоор байхгүй байна:
            </p>
            <p className="mt-0.5">
              {unavailableSelected
                .map((p) => `${p.brand} — ${p.name}`)
                .join(", ")}
            </p>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                onClick={removeUnavailable}
                className="font-medium underline underline-offset-2"
              >
                Эдгээрийг хасах
              </button>
              <span className="text-muted-foreground">
                эсвэл өөр хэмжээ сонгоно уу.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Catalog-style controls — mobile row */}
      <div className="border-border flex items-center gap-2 border-y py-3 lg:hidden">
        <CatalogFilterSheet
          brands={brands}
          priceBounds={priceBounds}
          families={families}
        />
        <CatalogSort iconOnly />
        <CatalogSearch className="flex-1" />
      </div>

      <div className="mt-6 flex gap-10 lg:mt-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-96 shrink-0 lg:block">
          <CatalogSearch className="mb-6" />
          <CatalogFilters
            brands={brands}
            priceBounds={priceBounds}
            families={families}
          />
        </aside>

        <div className="flex-1">
          {tray}
          <div className="mb-4 hidden items-center justify-end lg:flex">
            <CatalogSort />
          </div>

          {grid.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Тохирох үнэртэн олдсонгүй.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {grid.map((p) => {
                const stock = Boolean(p.variantByMl[ml]?.inStock);
                const on = ids.includes(p.productId);
                // Can't add something the chosen size can't fill; an already-
                // picked one stays removable.
                const disabled = !on && (!stock || atMax);
                return (
                  <div
                    key={p.productId}
                    className="group relative flex flex-col"
                  >
                    <div
                      className={cn(
                        "border-border relative aspect-4/5 overflow-hidden rounded-2xl border transition-all",
                        on && "border-gold-strong ring-gold-strong/40 ring-2",
                      )}
                    >
                      {p.image && (
                        <Image
                          src={p.image.url}
                          alt={p.image.alt || p.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          className={cn(
                            "object-cover",
                            !stock && "opacity-40 grayscale",
                          )}
                        />
                      )}
                      {/* Unavailable-at-this-size badge, so a searched scent
                          reads as "here, but not in this ml" not "missing". */}
                      {!stock && (
                        <span className="bg-background/85 text-muted-foreground absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur">
                          {ml}ml-д байхгүй
                        </span>
                      )}
                      <button
                        onClick={() => toggle(p.productId)}
                        disabled={disabled}
                        aria-pressed={on}
                        aria-label={on ? "Хасах" : "Нэмэх"}
                        className={cn(
                          "shadow-lift absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full transition-colors",
                          on
                            ? "bg-gold-strong text-white"
                            : disabled
                              ? "bg-secondary/80 text-muted-foreground cursor-not-allowed"
                              : "bg-background hover:bg-accent",
                        )}
                      >
                        {on ? (
                          <Check className="text-background size-4" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                        {p.brand}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          stock
                            ? "text-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {stock
                          ? formatPrice(p.variantByMl[ml]?.price ?? 0)
                          : `${ml}ml-д байхгүй`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-3">
          <DialogTitle className="font-serif">Багц үүсгэх</DialogTitle>
          <label className="text-sm font-medium">
            Нэр
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Жишээ: Миний дуртай 4"
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Тайлбар
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Сонголттой"
              className="mt-1"
            />
          </label>
          {isLoggedIn ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={save}
                onChange={(e) => setSave(e.target.checked)}
                className="size-4"
              />
              «Миний багцууд»-д хадгалах
            </label>
          ) : (
            <p className="text-muted-foreground text-xs">
              Багцаа хадгалахын тулд нэвтэрнэ үү. Одоо шууд сагсанд нэмнэ.
            </p>
          )}
          <Button
            disabled={busy || !canCreate}
            onClick={create}
            className="w-full"
          >
            Сагсанд нэмэх
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
