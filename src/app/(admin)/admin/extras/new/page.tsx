import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getExtraCategories,
  getVialOptions,
} from "@/features/extras/admin-api";
import { ExtraCategoryTiles } from "@/features/extras/components/admin/extra-category-tiles";
import { ExtraForm } from "@/features/extras/components/admin/extra-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нэмэлт бараа нэмэх" };

/**
 * Шинэ нэмэлт бараа: эхлээд 6 ангиллын tile (`?cat=` сонгогдоогүй үед),
 * дараа нь тухайн ангиллын горимын маягт (plan §7.2).
 */
export default async function NewExtraPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { cat } = await searchParams;
  const [categories, vialsOn] = await Promise.all([
    getExtraCategories(),
    isFeatureEnabled("vial_inventory"),
  ]);
  const category = categories.find((c) => c.slug === cat);
  // Грамын сав нь савны тоон нөөцтэй л утгатай (plan §7.2).
  const blocked = category?.mode === "shared_vial" && !vialsOn;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/extras"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Нэмэлт бараа
      </Link>
      {!category || blocked ? (
        <>
          <PageHeader
            title="Ямар бараа нэмэх вэ?"
            description="Ангиллаа сонгоход тухайн барааны маягт нээгдэнэ."
          />
          <ExtraCategoryTiles categories={categories} vialsOn={vialsOn} />
        </>
      ) : (
        <>
          <PageHeader title={`${category.name} нэмэх`} />
          <ExtraForm
            category={category}
            extra={null}
            vials={
              category.mode === "shared_vial" ? await getVialOptions() : []
            }
          />
        </>
      )}
    </div>
  );
}
