import { getProductOptions } from "@/features/admin/api";
import { PRODUCT_OPTION_MAX } from "@/features/admin/lib/product-option";
import { getGiftSettings } from "@/features/content/api";
import { GiftPoolManager } from "@/features/admin/components/gift-pool-manager";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

/**
 * Бэлгийн үнэрүүдийн сан: админ 6–8 ус сонгож, худалдан авагч checkout дээр
 * зөвхөн эндээс 1мл бэлгээ сонгоно. Сар бүр солих үүрэггүй — хүссэн үедээ
 * шинэчилнэ (backlog A2–A3).
 */
export default async function AdminGiftsPage() {
  const settings = await getGiftSettings();
  // Сонгогдсон ус + БҮХ бараа: бэлгийн ус сонгохдоо админ каталогоо гүйлгэж
  // хардаг тул энэ дэлгэц дээр жагсаалт нь хайлтаас хамаарахгүй.
  const [selected, all] = await Promise.all([
    getProductOptions({ ids: settings.productIds }),
    getProductOptions({ limit: PRODUCT_OPTION_MAX }),
  ]);
  const seen = new Set(selected.map((p) => p.id));
  const options = [...selected, ...all.filter((p) => !seen.has(p.id))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Бэлгийн үнэрүүд — 1мл дээж"
        // description="Худалдан авагч 200,000₮ тутамд (купоны дараах, хүргэлтгүй дүнгээр), мөн бэлэн 5/10/20мл багц бүрээс 1 ширхэг — алийг нь ихийг нь — доорх уснуудаас 1мл дээжээр сонгоно. 6–8 ус байлгахыг зөвлөнө; сар бүр солих шаардлагагүй, хүссэн үедээ шинэчилнэ."
      />
      <GiftPoolManager options={options} initial={settings} />
    </div>
  );
}
