import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Pagination for a server-rendered admin list.
 *
 * Always states the real total — a page counter alone cannot tell "3 matches"
 * from "300 matches", which is the whole reason an operator applies a filter.
 * Links rather than buttons, so back and share work.
 */
export function ServerPager({
  page,
  perPage,
  total,
  hrefForPage,
}: {
  /** Zero-based. */
  page: number;
  perPage: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const first = page * perPage + 1;
  const last = Math.min((page + 1) * perPage, total);

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground">
        {total.toLocaleString("mn-MN")}-аас {first.toLocaleString("mn-MN")}–
        {last.toLocaleString("mn-MN")}
      </span>
      {pageCount > 1 && (
        <>
          <Button
            variant="secondary"
            className="h-11 md:h-9"
            disabled={page === 0}
            asChild={page > 0}
          >
            {page > 0 ? (
              <Link href={hrefForPage(page - 1)}>Өмнөх</Link>
            ) : (
              <span>Өмнөх</span>
            )}
          </Button>
          <Button
            variant="secondary"
            className="h-11 md:h-9"
            disabled={page + 1 >= pageCount}
            asChild={page + 1 < pageCount}
          >
            {page + 1 < pageCount ? (
              <Link href={hrefForPage(page + 1)}>Дараах</Link>
            ) : (
              <span>Дараах</span>
            )}
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Build `?a=b` hrefs that carry every current filter forward. Dropping a
 * filter when the operator clicks a status chip is silent data loss.
 */
export function makeHrefBuilder(
  basePath: string,
  current: Record<string, string | undefined>,
) {
  return (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
}
