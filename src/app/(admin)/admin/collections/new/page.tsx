import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAllProducts } from "@/features/products/api";
import { getCollectionSettings } from "@/features/collections/api";
import { fetchCustomTags } from "@/features/taxonomy/api";
import { CollectionForm } from "@/features/admin/components/collection-form";
import { toAdminProducts } from "../to-admin-products";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const [products, customTagPool, settings] = await Promise.all([
    getAllProducts(),
    fetchCustomTags(),
    getCollectionSettings(),
  ]);
  return (
    <div className="space-y-6">
      <Link
        href="/admin/collections"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Багц руу буцах
      </Link>
      <h1 className="font-serif text-2xl font-semibold">Шинэ багц нэмэх</h1>
      <CollectionForm
        products={toAdminProducts(products)}
        customTagPool={customTagPool}
        roundTo={settings.roundTo}
        defaultDiscountPct={settings.baseDefaultDiscountPct}
      />
    </div>
  );
}
