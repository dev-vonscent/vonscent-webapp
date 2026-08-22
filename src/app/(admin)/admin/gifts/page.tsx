import { getAdminProducts } from "@/features/admin/api";
import { getGiftSettings } from "@/features/content/api";
import { GiftPoolManager } from "@/features/admin/components/gift-pool-manager";

export const dynamic = "force-dynamic";

/**
 * Сар бүрийн бэлгийн sample-ийн сан (questions.md №2): the admin curates the
 * 4–8 perfumes buyers can pick their free 1ml samples from at checkout.
 */
export default async function AdminGiftsPage() {
  const [products, settings] = await Promise.all([
    getAdminProducts(),
    getGiftSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">
          Сарын бэлгийн sample
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Худалдан авагч 200,000₮ тутамд (купоны дараах, хүргэлтгүй дүнгээр)
          доорх уснуудаас 1мл sample-аа checkout дээр сонгоно. Сар бүр 4–8 ус
          сонгохыг зөвлөнө.
        </p>
      </div>
      <GiftPoolManager
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          availableMl: p.availableMl,
          isActive: p.isActive,
        }))}
        initial={settings}
      />
    </div>
  );
}
