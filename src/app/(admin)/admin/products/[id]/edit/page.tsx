import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminProduct } from "@/features/admin/api";
import { ProductEditForm } from "@/features/admin/components/product-edit-form";
import {
  getScentFamilies,
  fetchCustomTags,
  fetchBrands,
  fetchConcentrations,
} from "@/features/taxonomy/api";
import { isImageGenConfigured } from "@/lib/env";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, families, customTagPool, brands, concentrations] =
    await Promise.all([
      getAdminProduct(id),
      getScentFamilies(),
      fetchCustomTags(),
      // Edit reads the *full* list, hidden brands included: a product already
      // on a retired brand must keep showing it rather than silently losing it.
      fetchBrands(),
      // Same reason for concentrations (0085).
      fetchConcentrations(),
    ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Бараа
      </Link>
      <h1 className="font-serif text-2xl font-semibold">Бараа засах</h1>
      <ProductEditForm
        product={product}
        families={families}
        brands={brands}
        concentrations={concentrations}
        customTagPool={customTagPool}
        aiEnabled={isImageGenConfigured}
      />
    </div>
  );
}
