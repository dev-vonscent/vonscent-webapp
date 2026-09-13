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
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

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
      <PageHeader
        title="Бараа"
        count={total ?? undefined}
        actions={
          <Button asChild className="shrink-0">
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              Бараа нэмэх
            </Link>
          </Button>
        }
      />

      <ProductsToolbar />

      {rows.length === 0 ? (
        <ProductsEmpty filtering={filtering} />
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
function ProductsEmpty({ filtering }: { filtering: boolean }) {
  return (
    <EmptyState
      surface="card"
      icon={PackageSearch}
      title={filtering ? "Тохирох бараа олдсонгүй" : "Каталог хоосон байна"}
      description={
        filtering
          ? "Хайлт, шүүлтүүрээ өөрчилж үзнэ үү."
          : "Эхний барааг нэмээд хэмжээ тус бүрийн үнийг бичихэд дэлгүүр ажиллаж эхэлнэ."
      }
      action={
        filtering ? (
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
        )
      }
    />
  );
}
