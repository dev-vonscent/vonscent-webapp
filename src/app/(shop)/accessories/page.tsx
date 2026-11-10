import type { Metadata } from "next";
import { MarkSeen } from "@/components/shared/mark-seen";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getShopExtras } from "@/features/extras/api";
import { AccessoriesCatalog } from "@/features/extras/components/accessories-catalog";
import { extraSection } from "@/features/extras/lib/sections";

export const revalidate = 60;

export const metadata: Metadata = {
  ...pageMetadata("/accessories"),
  title: "Дагалдах хэрэгсэл",
  description:
    "Гоёмсог бэлгийн сав, грамын сав, шприц — үнэртнээ бэлэглэх, цутгах, авч явахад.",
};

/**
 * «Дагалдах хэрэгсэл» (extras-shop-plan §19.3) — шүүлтүүргүй, ангиллаар
 * хэсэглэсэн. Туг `extras_shop` хаалттай бол 404.
 */
export default async function AccessoriesPage() {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const items = (await getShopExtras()).filter(
    (e) => extraSection(e) === "accessories",
  );
  return (
    <div className="mx-auto max-w-420 px-4 py-8 md:px-8">
      <div className="mb-4">
        <h1 data-page-title className="text-3xl font-semibold tracking-tight">
          Дагалдах хэрэгсэл
        </h1>
        <p className="text-muted-foreground mt-1 text-sm text-pretty">
          Үнэртнээ бэлэглэх, цутгах, авч явахад хэрэгтэй бүхэн.
        </p>
      </div>
      <MarkSeen seenKey="accessories" />
      <AccessoriesCatalog items={items} />
    </div>
  );
}
