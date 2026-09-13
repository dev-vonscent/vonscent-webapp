import type { Metadata } from "next";
import { getAllHomeSections, getProductOptions } from "@/features/admin/api";
import { HomeSectionManager } from "@/features/admin/components/home-section-manager";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Нүүрийн хэсэг" };

export default async function HomeSectionsPage() {
  const sections = await getAllHomeSections();
  // Гараар сонгосон бүх бараа (нэрээр нь харуулахад хэрэгтэй) + эхний хуудас.
  // Бүх каталогийг илгээхээ болив — сонгогч хайлтаараа сервер дээрээс уншина.
  const pickedIds = [...new Set(sections.flatMap((s) => s.productIds))];
  const [selected, firstPage] = await Promise.all([
    getProductOptions({ ids: pickedIds }),
    getProductOptions({}),
  ]);
  const seen = new Set(selected.map((p) => p.id));
  const options = [...selected, ...firstPage.filter((p) => !seen.has(p.id))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Нүүрийн хэсэг"
        description="«Онцлох», «Багц уснууд» зэрэг хэсгийг үүсгэж, дотор нь харагдах барааг гараар сонгож эрэмбэлнэ, эсвэл «Онцлох» тэмдэгтэй барааг автоматаар харуулна. Бараагүй хэсэг нүүр хуудсанд харагдахгүй."
      />
      <HomeSectionManager sections={sections} options={options} />
    </div>
  );
}
