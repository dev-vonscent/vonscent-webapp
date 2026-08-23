import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminProducts } from "@/features/admin/api";
import { ProductsToolbar } from "@/features/admin/components/products-toolbar";
import { ProductsTable } from "@/features/admin/components/products-table";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { q, status, sort } = await searchParams;
  let products = await getAdminProducts();

  if (q) {
    const needle = q.toLowerCase();
    products = products.filter((p) =>
      `${p.name} ${p.brand}`.toLowerCase().includes(needle),
    );
  }
  if (status === "active") products = products.filter((p) => p.isActive);
  else if (status === "hidden") products = products.filter((p) => !p.isActive);
  else if (status === "low")
    products = products.filter(
      (p) => p.availableMl > 0 && p.availableMl <= p.lowStockMl,
    );
  else if (status === "soldout")
    products = products.filter((p) => p.availableMl <= 0);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Бараа</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            Бараа нэмэх
          </Link>
        </Button>
      </div>

      <ProductsToolbar />

      <ProductsTable data={products} />
    </div>
  );
}
