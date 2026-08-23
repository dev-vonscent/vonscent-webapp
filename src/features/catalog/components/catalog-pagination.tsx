"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Page numbers worth showing: first, last, current ±1, with "…" gaps.
 * A gap of exactly one page is filled with the number itself — an ellipsis
 * hiding a single page is just a worse button.
 */
export function paginationItems(
  page: number,
  pages: number,
): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const wanted = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages]);
  const items: (number | "…")[] = [];
  let prev = 0;
  for (let p = 1; p <= pages; p++) {
    if (!wanted.has(p)) continue;
    if (p - prev === 2) items.push(p - 1);
    else if (p - prev > 2) items.push("…");
    items.push(p);
    prev = p;
  }
  return items;
}

export function CatalogPagination({
  page,
  perPage,
  total,
}: {
  page: number;
  perPage: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;

  function go(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`, { scroll: true });
  }

  return (
    <div className="mt-12 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        Өмнөх
      </Button>
      {paginationItems(page, pages).map((p, i) =>
        p === "…" ? (
          <span
            key={`gap-${i}`}
            className="text-muted-foreground w-6 text-center text-sm"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            className="w-9"
            onClick={() => go(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
      >
        Дараах
      </Button>
    </div>
  );
}
