"use client";

import Link from "next/link";
import { PackageSearch, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { CatalogSort } from "@/features/catalog/components/catalog-sort";
import { FilterSheet } from "@/features/catalog/components/catalog-filter-sheet";
import { Chip, Group } from "@/features/catalog/components/catalog-filters";
import { useFilterQuery } from "@/features/catalog/components/use-filter-query";
import type { ShopExtraListItem } from "../api";
import {
  filterExtras,
  isBottleCategory,
  parseExtraFilters,
} from "../lib/filter";
import { EXTRA_SORT_OPTIONS, parseExtraSort, sortExtras } from "../lib/sort";
import { ExtraCard } from "./extra-card";

interface Category {
  slug: string;
  name: string;
}

function categoriesOf(items: ShopExtraListItem[]): Category[] {
  const out = new Map<string, Category>();
  for (const i of items)
    if (!out.has(i.categorySlug))
      out.set(i.categorySlug, { slug: i.categorySlug, name: i.categoryName });
  // `items` нь ангиллын дарааллаар ирдэг (getShopExtras).
  return [...out.values()];
}

const SEARCH_PLACEHOLDER = "Нэмэлт бараа хайх…";

/**
 * Каталогийн «Нэмэлт бараа» таб — үнэртний каталогтой нэг бүтэц: зүүн талд
 * хайлт, шүүлтүүр (утсан дээр sheet), баруун талд үнэртний карттай ижил
 * хэмжээтэй grid. Бараа цөөн тул бүгд нэг дор ирж, шүүлт client дээр шууд.
 * Дагалдах хэрэгсэл (шприц, сав, бэлгийн сав) дээр, үнэртний шил доор —
 * худалдан авах зорилго, үнийн түвшин нь өөр.
 */
export function ExtrasCatalog({ items }: { items: ShopExtraListItem[] }) {
  const { searchParams, clearAll } = useFilterQuery();

  if (items.length === 0) {
    return (
      <EmptyState
        size="lg"
        className="mt-6"
        icon={PackageSearch}
        title="Нэмэлт бараа удахгүй нэмэгдэнэ"
        description="Бэлгийн сав, грамын сав, шприц, шилтэй ус энд гарна. Тэр хооронд үнэртнүүдээ сонирхоорой."
        action={
          <Button asChild variant="outline">
            <Link href="/catalog">Үнэртэн үзэх</Link>
          </Button>
        }
      />
    );
  }

  const categories = categoriesOf(items);
  const shown = sortExtras(
    filterExtras(items, parseExtraFilters(searchParams)),
    parseExtraSort(searchParams.get("sort")),
  );
  const accessories = shown.filter((e) => !isBottleCategory(e.categorySlug));
  const bottles = shown.filter((e) => isBottleCategory(e.categorySlug));
  const titled = accessories.length > 0 && bottles.length > 0;

  return (
    <>
      <div className="border-border flex items-center gap-2 border-y py-3 lg:hidden">
        <FilterSheet>
          <ExtrasFilters categories={categories} showClear={false} />
        </FilterSheet>
        <CatalogSort iconOnly options={EXTRA_SORT_OPTIONS} />
        <CatalogSearch className="flex-1" placeholder={SEARCH_PLACEHOLDER} />
      </div>

      <div className="mt-6 flex gap-10">
        <aside className="hidden w-72 shrink-0 lg:block">
          <CatalogSearch className="mb-6" placeholder={SEARCH_PLACEHOLDER} />
          <ExtrasFilters categories={categories} />
        </aside>

        {/* `min-w-0`: catalog/page.tsx-ийн тайлбарыг үз. */}
        <div className="min-w-0 flex-1">
          {shown.length === 0 ? (
            <EmptyState
              size="lg"
              icon={SearchX}
              title="Илэрц олдсонгүй"
              description="Шүүлтүүрээ өөрчилж дахин оролдоно уу."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Шүүлтүүр цэвэрлэх
                </Button>
              }
            />
          ) : (
            <div className="space-y-10">
              {accessories.length > 0 && (
                <Section
                  title={titled ? "Дагалдах хэрэгсэл" : null}
                  items={accessories}
                />
              )}
              {bottles.length > 0 && (
                <Section
                  title={titled ? "Үнэртний шил" : null}
                  items={bottles}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  items,
}: {
  title: string | null;
  items: ShopExtraListItem[];
}) {
  return (
    <section className="space-y-4">
      {title && (
        <h2 className="font-serif text-xl font-semibold tracking-tight">
          {title}
        </h2>
      )}
      {/* ProductGrid-тэй ижил багана — карт үнэртнийхтэй нэг хэмжээтэй. */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {items.map((e) => (
          <li key={e.id}>
            <ExtraCard
              extra={e}
              href={`/extras/${e.slug}`}
              quickAdd
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1408px) 25vw, 324px"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExtrasFilters({
  categories,
  showClear = true,
}: {
  categories: Category[];
  /** Утасны sheet «Цэвэрлэх»-ийг гарчгийн мөрөндөө харуулна. */
  showClear?: boolean;
}) {
  const { values, toggle, setSingle, searchParams, activeCount, clearAll } =
    useFilterQuery();
  const picked = values("cat");
  const inStock = searchParams.get("stock") === "1";

  return (
    <div className="space-y-4">
      {showClear && activeCount > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Цэвэрлэх ({activeCount})
          </Button>
        </div>
      )}
      {/* Үнэртний шүүлтүүртэй ижил тэнцүү 2 багана. Урт нэр («Гоёмсог
          бэлгийн сав») тасрахгүй хоёр мөр болно — мөрийн chip-үүд өндрөөрөө
          тэнцэнэ. */}
      <Group title="Ангилал">
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <Chip
              key={c.slug}
              active={picked.includes(c.slug)}
              onClick={() => toggle("cat", c.slug)}
              className="leading-tight text-balance whitespace-normal!"
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </Group>
      <Separator />
      {/* Нэг асаах/унтраах — ганц chip бүхэл бүлэг эзэлдэг байв. */}
      <div className="flex items-center gap-3">
        <Checkbox
          id="extras-in-stock"
          checked={inStock}
          onCheckedChange={(v) => setSingle("stock", v ? "1" : undefined)}
        />
        <Label htmlFor="extras-in-stock" className="text-sm font-medium">
          Зөвхөн байгаа бараа
        </Label>
      </div>
    </div>
  );
}
