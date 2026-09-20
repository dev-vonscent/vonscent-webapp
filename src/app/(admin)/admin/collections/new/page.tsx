import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCollectionSettings } from "@/features/collections/api";
import { countProducts, getProductOptions } from "@/features/admin/api";
import { PRODUCT_OPTION_MAX } from "@/features/admin/lib/product-option";
import { fetchCustomTags } from "@/features/taxonomy/api";
import { CollectionForm } from "@/features/admin/components/collection-form";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  // Багц угсрахад каталогоо ГҮЙЛГЭЖ хардаг — нэрийг нь урьдчилж мэдэхгүй
  // байж хайлтаар таамаглах биш. Тиймээс бэлгийн сантай (`/admin/gifts`)
  // ижил «бүгдийг харуул» горим: сонгогчийн хөнгөн мөр тул ~80 бараа хэдхэн
  // КБ болно, хайлт нь зөвхөн нэмэлт шүүлтүүр.
  const [options, customTagPool, settings, total] = await Promise.all([
    getProductOptions({ limit: PRODUCT_OPTION_MAX }),
    fetchCustomTags(),
    getCollectionSettings(),
    countProducts(),
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
        products={options}
        totalProducts={total}
        customTagPool={customTagPool}
        roundTo={settings.roundTo}
        defaultDiscountPct={settings.baseDefaultDiscountPct}
      />
    </div>
  );
}
