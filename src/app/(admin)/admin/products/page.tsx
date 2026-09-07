import Link from "next/link";
import { Plus, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PRODUCTS_PER_PAGE,
  getAdminProductPage,
} from "@/features/admin/api";
import { ProductsToolbar } from "@/features/admin/components/products-toolbar";
import { ProductsTable } from "@/features/admin/components/products-table";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vis?: string;
    stock?: string;
    /** Legacy single filter, kept so old links and bookmarks still land. */
    status?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const { q, vis, stock, status, sort, page } = await searchParams;

  // Visibility and stock used to share one `status` parameter, which made them
  // mutually exclusive. Old links carrying it are mapped onto whichever of the
  // two dimensions they actually meant.
  const visibility = vis ?? legacyVisibility(status);
  const stockFilter = stock ?? legacyStock(status);
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);

  // Шүүлт, эрэмбэ, хуудаслалт бүгд өгөгдлийн санд (backlog H2) — энэ дэлгэц
  // өмнө нь 2000 барааг бүтнээр татаж аваад JS дотор шүүдэг байв.
  const { rows, total } = await getAdminProductPage({
    q,
    visibility,
    stock: stockFilter,
    sort,
    page: pageIndex,
  });

  const filtering = Boolean(q || visibility || stockFilter);
  const href = makeHrefBuilder("/admin/products", {
    q,
    vis: visibility,
    stock: stockFilter,
    sort,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">Бараа</h1>
        <Button asChild className="shrink-0">
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            Бараа нэмэх
          </Link>
        </Button>
      </div>

      <ProductsToolbar />

      {rows.length === 0 ? (
        <EmptyState filtering={filtering} />
      ) : (
        <>
          <ProductsTable data={rows} />
          {total !== null && (
            <ServerPager
              page={pageIndex}
              perPage={ADMIN_PRODUCTS_PER_PAGE}
              total={total}
              hrefForPage={(i) =>
                href({ page: i > 0 ? String(i + 1) : undefined })
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function legacyVisibility(status?: string): string {
  return status === "active" || status === "hidden" ? status : "";
}

function legacyStock(status?: string): string {
  return status === "low" || status === "soldout" ? status : "";
}

/**
 * Two different nothings. A catalogue with no products at all needs the way in;
 * a filter that matched nothing needs the way back — the shared table empty
 * ("Бараа алга") told the operator neither.
 */
function EmptyState({ filtering }: { filtering: boolean }) {
  return (
    <div className="bg-card rounded-lg px-6 py-14 text-center">
      <PackageSearch className="text-muted-foreground mx-auto size-8" />
      <p className="mt-4 font-medium">
        {filtering ? "Тохирох бараа олдсонгүй" : "Каталог хоосон байна"}
      </p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
        {filtering
          ? "Хайлт, шүүлтүүрээ өөрчилж үзнэ үү."
          : "Эхний барааг нэмээд хэмжээ тус бүрийн үнийг бичихэд дэлгүүр ажиллаж эхэлнэ."}
      </p>
      <div className="mt-5">
        {filtering ? (
          <Button variant="secondary" asChild>
            <Link href="/admin/products">Шүүлтүүр цэвэрлэх</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              Бараа нэмэх
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
