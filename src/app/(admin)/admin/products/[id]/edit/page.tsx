import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminProduct } from "@/features/admin/api";
import { ProductEditForm } from "@/features/admin/components/product-edit-form";
import { getScentFamilies } from "@/features/taxonomy/api";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, families] = await Promise.all([
    getAdminProduct(id),
    getScentFamilies(),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Бараа
      </Link>
      <h1 className="font-serif text-2xl font-semibold">Бараа засах</h1>
      <ProductEditForm product={product} families={families} />
    </div>
  );
}
