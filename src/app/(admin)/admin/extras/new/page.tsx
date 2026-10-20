import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getAdminExtra,
  getExtraCategories,
  getVialOptions,
} from "@/features/extras/admin-api";
import {
  ExtraCategoryTiles,
  MODE_TITLE,
} from "@/features/extras/components/admin/extra-category-tiles";
import { ExtraForm } from "@/features/extras/components/admin/extra-form";
import { BOTTLE_KIND, bottleKind } from "@/features/extras/lib/bottle-kind";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нэмэлт бараа нэмэх" };

/**
 * Шинэ нэмэлт бараа: эхлээд ангиллын tile (`?cat=` сонгогдоогүй үед),
 * дараа нь тухайн ангилал+горимын маягт (plan §7.2). Олон горимтой
 * ангилалд («Шилтэй ус») горим `?mode=`-оор заавал.
 */
export default async function NewExtraPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; mode?: string; from?: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { cat, mode: modeParam, from } = await searchParams;
  // «Дахин нийтлэх»: зөвхөн зарагдсан үлдэгдэлтэй шилээс (plan §18.4).
  const source =
    from && /^[0-9a-f-]{36}$/i.test(from) ? await getAdminExtra(from) : null;
  const relistFrom =
    source?.mode === "leftover_liquid" &&
    source.leftover?.lockState === "committed"
      ? source
      : null;
  const [categories, vialsOn] = await Promise.all([
    getExtraCategories(),
    isFeatureEnabled("vial_inventory"),
  ]);
  const category = categories.find((c) => c.slug === cat);
  const mode =
    category?.modes.length === 1
      ? category.modes[0]!.mode
      : category?.modes.find((m) => m.mode === modeParam)?.mode;
  // Грамын сав нь савны тоон нөөцтэй л утгатай (plan §7.2).
  const blocked = mode === "shared_vial" && !vialsOn;
  const kind = category && mode ? bottleKind(category.slug, mode) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/extras"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Нэмэлт бараа
      </Link>
      {!category || !mode || blocked ? (
        <>
          <PageHeader
            title="Ямар бараа нэмэх вэ?"
            description="Ангиллаа сонгоход тухайн барааны маягт нээгдэнэ."
          />
          <ExtraCategoryTiles categories={categories} vialsOn={vialsOn} />
        </>
      ) : (
        <>
          <PageHeader
            title={
              relistFrom
                ? `${relistFrom.name} — дахин нийтлэх`
                : `${kind ? BOTTLE_KIND[kind].title : category.modes.length > 1 ? MODE_TITLE[mode] : category.name} нэмэх`
            }
            description={
              relistFrom
                ? "Өмнөх шилний мэдээллийг хуулсан. Үлдсэн хэмжээ, үнээ шинээр бичнэ үү — хадгалахад хуучин шил архивлагдана."
                : undefined
            }
          />
          <ExtraForm
            category={category}
            mode={mode}
            extra={null}
            relistFrom={relistFrom}
            vials={mode === "shared_vial" ? await getVialOptions() : []}
          />
        </>
      )}
    </div>
  );
}
