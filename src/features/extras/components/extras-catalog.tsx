import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { ShopExtraListItem } from "../api";
import { sortExtras, type ExtraSort } from "../lib/sort";
import { categoryIcon } from "./category-icon";
import { ExtraCard } from "./extra-card";
import { ExtrasSort } from "./extras-sort";

/** Хэвтээ мөрөнд хэдэн карт — илүү нь «Бүгд N»-ээр. */
const ROW_LIMIT = 10;

interface Category {
  slug: string;
  name: string;
  count: number;
}

function categoriesOf(items: ShopExtraListItem[]): Category[] {
  const out = new Map<string, Category>();
  for (const i of items) {
    const c = out.get(i.categorySlug);
    if (c) c.count += 1;
    else
      out.set(i.categorySlug, {
        slug: i.categorySlug,
        name: i.categoryName,
        count: 1,
      });
  }
  // `items` нь ангиллын дарааллаар ирдэг (getShopExtras).
  return [...out.values()];
}

const href = (cat?: string, sort?: ExtraSort) => {
  const q = new URLSearchParams({ tab: "extras" });
  if (cat) q.set("cat", cat);
  if (sort && sort !== "recommended") q.set("sort", sort);
  return `/catalog?${q.toString()}`;
};

/**
 * Хэвтээ мөр: утсан дээр 2 бүтэн + хагас карт харагдана (дараагийнх нь
 * байгааг хэлнэ), snap-тэй. Том дэлгэцэд 4 багана.
 */
function ExtrasRow({ items }: { items: ShopExtraListItem[] }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
      {items.map((e) => (
        <li key={e.id} className="w-[40%] shrink-0 snap-start md:w-auto">
          <ExtraCard extra={e} href={`/extras/${e.slug}`} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Каталогийн «Нэмэлт бараа» таб (extras-shop-plan §9):
 *   · ангилал сонгоогүй — 6 ангиллын tile + ангилал бүрийн мөр, «Бүгд N»
 *   · `cat` сонгосон — наалддаг chip, 2 баганатай grid, «Хамт авдаг»
 * Шүүлтүүргүй — нэмэлт бараа цөөн тул эрэмбэ л хангалттай.
 */
export function ExtrasCatalog({
  items,
  activeCategory,
  sort,
}: {
  items: ShopExtraListItem[];
  activeCategory: string | null;
  sort: ExtraSort;
}) {
  const categories = categoriesOf(items);
  const current = categories.find((c) => c.slug === activeCategory) ?? null;

  if (items.length === 0) {
    return (
      <EmptyState
        size="lg"
        icon={PackageSearch}
        title="Нэмэлт бараа удахгүй нэмэгдэнэ"
        description="Бэлгийн хайрцаг, грамын сав, үлдэгдэлтэй шил энд гарна. Тэр хооронд үнэртнүүдээ сонирхоорой."
        action={
          <Button asChild variant="outline">
            <Link href="/catalog">Үнэртэн үзэх</Link>
          </Button>
        }
      />
    );
  }

  if (current) {
    const inCategory = sortExtras(
      items.filter((i) => i.categorySlug === current.slug),
      sort,
    );
    // «Хамт авдаг»: бусад ангиллын, одоо зарагдаж буй бараа.
    const together = sortExtras(
      items.filter((i) => i.categorySlug !== current.slug && !i.soldOut),
      "recommended",
    ).slice(0, 8);
    return (
      <div className="space-y-8">
        <nav
          aria-label="Ангилал"
          className="bg-background/90 sticky top-[calc(var(--header-offset)+3.75rem)] z-20 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-2 backdrop-blur transition-[top] duration-300 md:static md:mx-0 md:flex-wrap md:bg-transparent md:px-0 md:backdrop-blur-none"
        >
          <CategoryChip
            label="Бүгд"
            href={href(undefined, sort)}
            active={false}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.slug}
              label={c.name}
              href={href(c.slug, sort)}
              active={c.slug === current.slug}
            />
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {current.name} · {inCategory.length} бараа
          </p>
          <ExtrasSort />
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {inCategory.map((e) => (
            <li key={e.id}>
              <ExtraCard extra={e} href={`/extras/${e.slug}`} />
            </li>
          ))}
        </ul>
        {together.length > 0 && (
          <section aria-labelledby="extras-together" className="space-y-4">
            <h2
              id="extras-together"
              className="font-serif text-xl font-semibold tracking-tight"
            >
              Хамт авдаг
            </h2>
            <ExtrasRow items={together} />
          </section>
        )}
      </div>
    );
  }

  const sorted = sortExtras(items, sort);
  return (
    <div className="space-y-10">
      <ul className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
        {categories.map((c) => {
          const Icon = categoryIcon(c.slug);
          return (
            <li key={c.slug}>
              <Link
                href={href(c.slug, sort)}
                className="bg-secondary hover:bg-accent flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors"
              >
                <Icon className="text-muted-foreground size-6" aria-hidden />
                <span className="line-clamp-2 text-xs font-medium">
                  {c.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        <ExtrasSort />
      </div>

      {categories.map((c) => {
        const row = sorted.filter((i) => i.categorySlug === c.slug);
        return (
          <section
            key={c.slug}
            aria-labelledby={`extras-${c.slug}`}
            className="space-y-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id={`extras-${c.slug}`}
                className="font-serif text-xl font-semibold tracking-tight"
              >
                {c.name}
              </h2>
              <Link
                href={href(c.slug, sort)}
                className="text-muted-foreground hover:text-foreground text-sm whitespace-nowrap underline-offset-4 hover:underline"
              >
                Бүгд {c.count}
              </Link>
            </div>
            <ExtrasRow items={row.slice(0, ROW_LIMIT)} />
          </section>
        );
      })}
    </div>
  );
}

function CategoryChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
