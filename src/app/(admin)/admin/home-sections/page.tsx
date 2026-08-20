import type { Metadata } from "next";
import { getAllHomeSections, getAdminProducts } from "@/features/admin/api";
import { HomeSectionManager } from "@/features/admin/components/home-section-manager";

export const metadata: Metadata = { title: "Нүүрийн хэсэг" };

export default async function HomeSectionsPage() {
  const [sections, products] = await Promise.all([
    getAllHomeSections(),
    getAdminProducts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Нүүрийн хэсэг</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          «Онцлох», «Багц уснууд» зэрэг хэсгийг үүсгэж, дотор нь харагдах барааг
          гараар сонгож эрэмбэлнэ. Бараагүй хэсэг нүүр хуудсанд харагдахгүй.
        </p>
      </div>
      <HomeSectionManager
        sections={sections}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
        }))}
      />
    </div>
  );
}
