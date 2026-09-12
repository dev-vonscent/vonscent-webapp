"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BadgePercent, Check, Plus, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { BUNDLE_ML_SIZES, DEFAULT_BUNDLE_ML } from "@/lib/constants";
import { useCart } from "@/features/cart/store";
import { CatalogFilters } from "@/features/catalog/components/catalog-filters";
import { CatalogFilterSheet } from "@/features/catalog/components/catalog-filter-sheet";
import { CatalogSort } from "@/features/catalog/components/catalog-sort";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { CatalogPagination } from "@/features/catalog/components/catalog-pagination";
import { FilterQueryProvider } from "@/features/catalog/components/use-filter-query";
import { bundlePrice } from "../pricing";
import type { BuilderProduct, CollectionSettings } from "../types";
import type { ScentFamilyOption } from "@/lib/types";
import type { BrandLogos } from "@/features/products/components/brand-marquee";

function BuilderInner({
  products,
  total,
  page,
  perPage,
  settings,
  isLoggedIn,
  brands,
  brandLogos,
  priceBounds,
  families,
}: {
  /** ЗӨВХӨН энэ хуудсын бараа — шүүлт, эрэмбэ, хуудаслалт сервер дээр. */
  products: BuilderProduct[];
  total: number;
  page: number;
  perPage: number;
  settings: CollectionSettings;
  isLoggedIn: boolean;
  brands: string[];
  brandLogos: BrandLogos;
  priceBounds: { min: number; max: number };
  families: ScentFamilyOption[];
}) {
  const router = useRouter();
  const addCollection = useCart((s) => s.addCollection);

  const [ml, setMl] = React.useState<number>(DEFAULT_BUNDLE_ML);
  // Сонгосон барааг ID-гаар нь биш, БҮТНЭЭР нь санана. Шүүлт эсвэл хуудас
  // солигдоход тухайн бараа одоогийн хуудсанд байхаа болих ч сонголт
  // хэвээрээ үлдэх ёстой — өмнө нь бүх каталог санах ойд байсан тул энэ
  // асуудал байгаагүй.
  const [picked, setPicked] = React.useState<BuilderProduct[]>([]);
  const ids = picked.map((p) => p.productId);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [save, setSave] = React.useState(isLoggedIn);
  const [busy, setBusy] = React.useState(false);

  // Шүүлт, эрэмбэ, хуудаслалтыг сервер хийсэн — энд зөвхөн харагдац.
  const grid = products;
  const selected = picked;
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
  /**
   * The discount only exists once the bundle is big enough to buy.
   *
   * `bundlePrice` applies the percentage unconditionally, so the tray used to
   * quote a 5%-off total for three scents — a price nothing could be sold at,
   * since `computeSummary` drops any custom bundle under `minItems` and
   * «Багц үүсгэх» stays disabled. Counting `availableSelected` rather than
   * every pick matches `memberSum`, which only sums the members that this size
   * actually has in stock.
   */
  const discountEarned = availableSelected.length >= settings.minItems;
  const price = discountEarned
    ? bundlePrice(memberSum, settings.customDiscountPct, settings.roundTo)
    : memberSum;
  const saved = memberSum - price;

  const atMax = settings.maxItems != null && ids.length >= settings.maxItems;
  // Өөрөө угсарсан багц баталгаат бэлэг өгөхгүй (backlog A1) — бэлгийн эрх
  // нь зөвхөн захиалгын дүнгээс гарч, checkout дээр сонгогдоно.
  const canCreate =
    unavailableSelected.length === 0 && ids.length >= settings.minItems;

  function changeMl(next: number) {
    setMl(next);
  }

  function removeUnavailable() {
    const bad = new Set(unavailableSelected.map((p) => p.productId));
    setPicked((prev) => prev.filter((p) => !bad.has(p.productId)));
  }

  function toggle(product: BuilderProduct) {
    setPicked((prev) => {
      if (prev.some((p) => p.productId === product.productId))
        return prev.filter((p) => p.productId !== product.productId);
      if (settings.maxItems != null && prev.length >= settings.maxItems)
        return prev;
      return [...prev, product];
    });
  }

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
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
    setPicked([]);
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

          {/*
            The price, spelled out. It used to read «45,000₮ −2,300₮», which
            leaves the customer to work out both what they would have paid and
            what the second number is. Now the old total is struck through, the
            new one stands next to it, and the saving is named — the three
            facts a discount is actually made of.
          */}
          <div className="flex w-full flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-muted-foreground text-xs">
              <span className="text-foreground font-semibold">
                {availableSelected.length}
              </span>
              /{settings.minItems}
              {settings.maxItems ? `–${settings.maxItems}` : "+"}
            </span>

            {memberSum > 0 && saved > 0 && (
              <span className="text-muted-foreground text-sm line-through">
                {formatPrice(memberSum)}
              </span>
            )}
            {price > 0 && (
              <span className="font-serif text-lg leading-none font-semibold">
                {formatPrice(price)}
              </span>
            )}
            {saved > 0 && (
              <span className="text-gold-strong text-xs font-medium">
                {formatPrice(saved)} хэмнэлт
              </span>
            )}
          </div>
        </div>

        {/*
          Why the price dropped, or what it takes to make it drop. The discount
          was previously visible only as a bare «−2,300₮» once it had already
          applied, so a customer three scents in had no way to know that one
          more would take 5% off the lot.
        */}
        {/* <DiscountHint
          count={availableSelected.length}
          minItems={settings.minItems}
          pct={settings.customDiscountPct}
          active={discountEarned}
        /> */}

        {/* Selected scents — its own full-width row of larger thumbnails */}
        <div className="mt-3">
          {selected.length === 0 ? (
            <div className="border-border text-muted-foreground flex h-16 items-center justify-center rounded-xl border border-dashed px-3 text-center text-sm">
              Доорх үнэртнүүдээс {settings.minItems}+ сонгож багцаа бүрдүүлээд
              5%-ийн хэмнэлттэй аваарай.
            </div>
          ) : (
            /*
              The scents scroll; the create button does not. It is a sibling of
              the scroll container rather than a `sticky` child of it, so the
              thumbnails cannot slide underneath it and it needs no backdrop of
              its own — it simply owns the right-hand end of the row.

              `min-w-0` on the strip is what lets it shrink and scroll instead
              of pushing the button off the tray.
            */
            <div className="flex items-start gap-4">
              <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
                {selected.map((p) => {
                  const bad = !p.variantByMl[ml]?.inStock;
                  return (
                    <button
                      key={p.productId}
                      onClick={() => toggle(p)}
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

              {/*
                Create — pinned to the right of the row it acts on, a tile the
                same size as the scents so the strip reads as "these, then go".
                The primary action must not be the one thing you have to scroll
                to find.
              */}
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => {
                  setName("");
                  setDesc("");
                  setOpen(true);
                }}
                aria-label={
                  unavailableSelected.length > 0
                    ? `${unavailableSelected.length} үнэртэн ${ml}ml-д байхгүй`
                    : "Багц үүсгэх"
                }
                title={
                  unavailableSelected.length > 0
                    ? `${unavailableSelected.length} үнэртэн ${ml}ml-д байхгүй`
                    : "Багц үүсгэх"
                }
                className={cn(
                  "flex size-16 shrink-0 items-center justify-center rounded-xl transition-colors",
                  // Each state paints its own background. Sharing a `bg-card`
                  // base would put two background-colour utilities on one
                  // element, and which of them wins is down to the order
                  // Tailwind happens to emit them in.
                  canCreate
                    ? "bg-accent text-foreground hover:opacity-90"
                    : "bg-card border-border text-muted-foreground cursor-not-allowed border border-dashed",
                )}
              >
                <ShoppingBag className="size-5" />
              </button>
            </div>
          )}
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
          brandLogos={brandLogos}
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
            brandLogos={brandLogos}
            priceBounds={priceBounds}
            families={families}
          />
        </aside>

        {/*
          `min-w-0` is load-bearing: a flex child defaults to `min-width: auto`,
          so the selection tray pushed this column out to its own content width
          and the whole page scrolled sideways once a few scents were picked —
          76px of it, measured at 390px.
        */}
        <div className="min-w-0 flex-1">
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
                        onClick={() => toggle(p)}
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

          {/* Хуудаслалт — каталогийнхтай ижил хэрэгсэл. Сонгосон ус хуудас
              солиход ч сонгогдсон хэвээр үлдэнэ: `picked` нь барааг БҮТНЭЭР
              санадаг тул одоогийн хуудсанд байхаа болих нь хамаагүй
              (builder.test.tsx). */}
          <CatalogPagination page={page} perPage={perPage} total={total} />
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

/**
 * Каталогийн шүүлт/эрэмбэ/хайлтын хэрэгслүүд нэг л query state хуваалцдаг тул
 * багц угсрагчийг ч каталогийн адил provider дотор боох ёстой.
 */
export function CollectionBuilder(
  props: React.ComponentProps<typeof BuilderInner>,
) {
  return (
    <FilterQueryProvider>
      <BuilderInner {...props} />
    </FilterQueryProvider>
  );
}

/**
 * The bundle discount, stated before it applies.
 *
 * Three states, because the customer needs a different sentence at each: how
 * many more scents earn the discount, that the next one earns it, and that it
 * is now applied. A percentage only motivates while it is still reachable —
 * once it has landed the number in the header does the talking.
 */
function DiscountHint({
  count,
  minItems,
  pct,
  active,
}: {
  count: number;
  minItems: number;
  pct: number;
  /** True once a discount is actually coming off the total. */
  active: boolean;
}) {
  if (pct <= 0) return null;
  const missing = minItems - count;

  if (active) {
    return (
      <p className="border-gold-strong/30 bg-gold-strong/8 text-gold-strong mt-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium">
        <BadgePercent className="size-3.5 shrink-0" />
        {minItems}+ үнэртэн сонгосон тул {pct}% хямдрал бодогдлоо
      </p>
    );
  }

  return (
    <p className="bg-secondary text-muted-foreground mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs">
      <BadgePercent className="size-3.5 shrink-0" />
      {missing === 1 ? (
        <>
          <strong className="text-foreground">Дахин 1 үнэртэн</strong> сонговол{" "}
          {pct}% хямдрал нэмэгдэнэ
        </>
      ) : (
        <>
          <strong className="text-foreground">{minItems} үнэртэн</strong>{" "}
          сонговол {pct}% хямдрал нэмэгдэнэ
        </>
      )}
    </p>
  );
}
