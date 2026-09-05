import { getAdminProducts } from "@/features/admin/api";
import { getGiftSettings } from "@/features/content/api";
import { GiftPoolManager } from "@/features/admin/components/gift-pool-manager";

export const dynamic = "force-dynamic";

/**
 * Бэлгийн үнэрүүдийн сан: админ 6–8 ус сонгож, худалдан авагч checkout дээр
 * зөвхөн эндээс 1мл бэлгээ сонгоно. Сар бүр солих үүрэггүй — хүссэн үедээ
 * шинэчилнэ (backlog A2–A3).
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
          Бэлгийн үнэрүүд — 1мл дээж
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Худалдан авагч 200,000₮ тутамд (купоны дараах, хүргэлтгүй дүнгээр),
          мөн бэлэн 5/10/20мл багц бүрээс 1 ширхэг — алийг нь ихийг нь — доорх
          уснуудаас 1мл дээжээр сонгоно. 6–8 ус байлгахыг зөвлөнө; сар бүр
          солих шаардлагагүй, хүссэн үедээ шинэчилнэ.
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
