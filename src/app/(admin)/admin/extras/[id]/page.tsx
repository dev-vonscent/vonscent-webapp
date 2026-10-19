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
import { ExtraForm } from "@/features/extras/components/admin/extra-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нэмэлт бараа засах" };

export default async function EditExtraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { id } = await params;
  const [extra, categories] = await Promise.all([
    getAdminExtra(id),
    getExtraCategories(),
  ]);
  const category = categories.find((c) => c.id === extra?.categoryId);
  if (!extra || !category) notFound();
  const vials = extra.mode === "shared_vial" ? await getVialOptions() : [];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/extras"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Нэмэлт бараа
      </Link>
      <PageHeader title={extra.name} description={category.name} />
      {/* Хадгалсны дараа серверийн шинэ өгөгдлөөр маягтыг дахин эхлүүлнэ;
          нөөцийн цонх (`updatedAt` нь хувилбарынх) маягтыг цэвэрлэхгүй. */}
      <ExtraForm
        key={extra.updatedAt}
        category={category}
        extra={extra}
        vials={vials}
      />
    </div>
  );
}
