import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCollectionSettings } from "@/features/collections/api";
import { getProductOptions } from "@/features/admin/api";
import { fetchCustomTags } from "@/features/taxonomy/api";
import { CollectionForm } from "@/features/admin/components/collection-form";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  // Сонгогчид эхний хуудас хангалттай — цаашийг форм өөрөө хайж уншина.
  // Өмнө нь энд БҮХ каталог (`getAllProducts()`) ирж, браузар руу бүтнээрээ
  // дамждаг байв.
  const [options, customTagPool, settings] = await Promise.all([
    getProductOptions({}),
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
        products={options}
        customTagPool={customTagPool}
        roundTo={settings.roundTo}
        defaultDiscountPct={settings.baseDefaultDiscountPct}
      />
    </div>
  );
}
