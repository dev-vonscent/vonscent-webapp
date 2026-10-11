"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Loader2 } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/features/products/components/product-grid";
import { ProductGridSkeleton } from "@/components/shared/skeletons";
import { mixCatalog } from "@/features/products/rail";
import type { Collection } from "@/features/collections/types";
import type { CardStatus } from "@/features/products/card-status";
import type { CatalogFilters, CatalogResult } from "@/lib/types";

/** Дараагийн хуудасны дугаар, эсвэл бүгд ачаалагдсан бол `undefined`. */
export function nextCatalogPage(last: CatalogResult): number | undefined {
  return last.page * last.perPage < last.total ? last.page + 1 : undefined;
}

function scrollToTop() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/** `query` нь `page`-гүй шүүлтүүрийн query string. */
function withPage(query: string, page: number): string {
  const qs = new URLSearchParams(query);
  if (page > 1) qs.set("page", String(page));
  else qs.delete("page");
  const s = qs.toString();
  return s ? `/catalog?${s}` : "/catalog";
}

async function fetchCatalogPage(
  query: string,
  page: number,
): Promise<CatalogResult> {
  const qs = new URLSearchParams(query);
  qs.set("page", String(page));
  const res = await fetch(`/api/catalog?${qs}`);
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return res.json();
}

/**
 * Каталогийн жагсаалт — доош гүйлгэхэд дараагийн 24 нь өөрөө залгагдана.
 *
 * Эхний хуудас серверээс (`initial`) ирдэг тул HTML-д бараа шууд байна.
 * Доорх «Цааш үзэх» нь жинхэнэ `?page=n` холбоос: хайлтын робот, JS-гүй
 * хөтөч түүгээр дараагийн хуудас руу орно; JS-тэй үед түүн дээр хүрч ирэхэд
 * (эсвэл дарахад) дараагийнх нь энэ хуудсанд залгагдана.
 *
 * Ачаалсан хуудсууд TanStack Query-д `query`-ээр түлхүүрлэгдэж хадгалагдана:
 * бараа нээгээд буцахад жагсаалт бүтнээрээ шууд зурагдах тул хөтөч гүйлгэлтийн
 * байрлалаа сэргээж чадна. Шүүлтүүр солигдоход хуудас `key={query}`-ээр
 * шинээр mount болно.
 */
export function CatalogInfiniteGrid({
  initial,
  query,
  collections = [],
  sort,
  prefer,
}: {
  initial: CatalogResult;
  query: string;
  /** Шүүлтүүрт таарсан багцууд (`getCatalogCollections`) — эрэмбээрээ
   *  усуудтай холилдоно. */
  collections?: Collection[];
  sort?: CatalogFilters["sort"];
  /** Шүүсэн төлөв card дээр түрүүлнэ (`preferredStatuses`). */
  prefer?: CardStatus[];
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    // Эхлэх хуудас түлхүүрт орно: `?page=3`-аас эхэлсэн жагсаалт энгийн
    // `/catalog`-ийн кэшийг эзлэх ёсгүй.
    queryKey: ["catalog", query, initial.page],
    queryFn: ({ pageParam }) => fetchCatalogPage(query, pageParam),
    initialPageParam: initial.page,
    getNextPageParam: nextCatalogPage,
    initialData: { pages: [initial], pageParams: [initial.page] },
  });

  const pages = data.pages;
  // LIMIT/OFFSET хуудаслалт: хоёр ачааллын хооронд бараа нэмэгдвэл (эсвэл
  // эрэмбэ тэнцвэл) нэг бараа хоёр хуудсанд давтагдаж болно — давхардсан
  // React key-ээс сэргийлж эхний тохиолдлыг л үлдээнэ.
  const items = React.useMemo(() => {
    const seen = new Set<string>();
    return pages
      .flatMap((p) => p.items)
      .filter((item) => !seen.has(item.id) && !!seen.add(item.id));
  }, [pages]);
  const last = pages[pages.length - 1];
  const nextPage = nextCatalogPage(last);
  // Богино жагсаалтад (нэг-хоёр мөр) дээш буцах зүйл байхгүй.
  const showBackToTop = !nextPage && items.length > 8;

  const sentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || isFetchNextPageError) {
      return;
    }
    // Шинэ observer бүр эхний төлөвөө шууд мэдээлдэг. `pages.length`-ээр
    // дахин үүсгэснээр өндөр дэлгэц дээр ачаалсны дараа ч sentinel харагдсаар
    // байвал дараагийнх нь үргэлжлэн ачаалагдана.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void fetchNextPage();
      },
      // Хэрэглэгч ёроолд хүрэхээс өмнө ачаалж эхэлнэ.
      { rootMargin: "0px 0px 800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    pages.length,
  ]);

  return (
    <>
      {initial.page > 1 && (
        <div className="mb-6 flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={withPage(query, 1)}>Эхний бараануудыг үзэх</Link>
          </Button>
        </div>
      )}

      {collections.length > 0 ? (
        <ProductGrid
          items={mixCatalog(items, collections, sort, nextPage === undefined)}
          prefer={prefer}
        />
      ) : (
        <ProductGrid products={items} prefer={prefer} />
      )}

      {isFetchingNextPage && (
        <div className="mt-8">
          <ProductGridSkeleton count={4} />
        </div>
      )}

      <div ref={sentinelRef} className="mt-12 flex flex-col items-center gap-3">
        {isFetchNextPageError ? (
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            Ачаалж чадсангүй — дахин оролдох
          </Button>
        ) : isFetchingNextPage ? (
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Ачаалж байна…
          </span>
        ) : nextPage ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={withPage(query, nextPage)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                void fetchNextPage();
              }}
            >
              Цааш үзэх
            </a>
          </Button>
        ) : showBackToTop ? (
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToTop}
            className="animate-fade-up motion-reduce:animate-none"
          >
            <ArrowUp
              aria-hidden
              className="animate-nudge-up size-4 motion-reduce:animate-none"
            />
            Дээш буцах
          </Button>
        ) : null}
      </div>
    </>
  );
}
