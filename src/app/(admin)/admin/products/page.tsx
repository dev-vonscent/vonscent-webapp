import Link from "next/link";
import { Plus, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PRODUCTS_CAP,
  getAdminProducts,
  productsWereCapped,
} from "@/features/admin/api";
import { ProductsToolbar } from "@/features/admin/components/products-toolbar";
import { ProductsTable } from "@/features/admin/components/products-table";
import { stockState } from "@/features/admin/lib/stock-state";

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
  }>;
}) {
  const { q, vis, stock, status, sort } = await searchParams;
  const [all, capped] = await Promise.all([
    getAdminProducts(),
    productsWereCapped(),
  ]);
  let products = all;

  // Visibility and stock used to share one `status` parameter, which made them
  // mutually exclusive. Old links carrying it are mapped onto whichever of the
  // two dimensions they actually meant.
  const visibility = vis ?? legacyVisibility(status);
  const stockFilter = stock ?? legacyStock(status);

  if (q) {
    const needle = q.toLowerCase();
    products = products.filter((p) =>
      `${p.name} ${p.brand}`.toLowerCase().includes(needle),
    );
  }
  if (visibility === "active") products = products.filter((p) => p.isActive);
  else if (visibility === "hidden")
    products = products.filter((p) => !p.isActive);

  if (stockFilter)
    products = products.filter(
      (p) => stockState(p.availableMl, p.lowStockMl) === stockFilter,
    );

  products = [...products].sort((a, b) => {
    switch (sort) {
      case "brand":
        return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
      case "price-asc":
        return a.startingPrice - b.startingPrice;
      case "price-desc":
        return b.startingPrice - a.startingPrice;
      case "stock":
        return a.availableMl - b.availableMl;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const filtering = Boolean(q || visibility || stockFilter);

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

      {capped && (
        <p
          role="status"
          className="bg-warning/15 text-warning rounded-md px-4 py-3 text-sm"
        >
          Каталог {ADMIN_PRODUCTS_CAP.toLocaleString("mn-MN")} бараанаас
          хэтэрсэн тул зөвхөн хамгийн сүүлд нэмэгдсэн{" "}
          {ADMIN_PRODUCTS_CAP.toLocaleString("mn-MN")} нь энд харагдаж байна.
        </p>
      )}

      {products.length === 0 ? (
        <EmptyState filtering={filtering} />
      ) : (
        <ProductsTable data={products} />
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
