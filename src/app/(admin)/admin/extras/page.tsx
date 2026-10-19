import Link from "next/link";
import { notFound } from "next/navigation";
import { PackagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getAdminExtras,
  getExtraCategories,
} from "@/features/extras/admin-api";
import { ExtrasAdminList } from "@/features/extras/components/admin/extras-admin-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нэмэлт бараа" };

/**
 * Админ → Каталог → Нэмэлт бараа (extras-shop-plan §7). Бэлгийн хайрцаг,
 * грамын сав, үлдэгдэлтэй шил, шприц г.м. Туг хаалттай бол 404.
 */
export default async function AdminExtrasPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { cat } = await searchParams;
  const [extras, categories] = await Promise.all([
    getAdminExtras(),
    getExtraCategories(),
  ]);
  const active = categories.some((c) => c.slug === cat) ? cat! : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Нэмэлт бараа"
        count={extras.length}
        description="Үнэртнээс гадуурх бараа: бэлгийн хайрцаг, грамын сав, үлдэгдэлтэй шил, шприц."
        actions={
          <Button asChild>
            <Link href="/admin/extras/new">
              <Plus className="size-4" /> Бараа нэмэх
            </Link>
          </Button>
        }
      />
      {extras.length === 0 ? (
        <EmptyState
          surface="card"
          icon={PackagePlus}
          title="Нэмэлт бараа алга байна. Эхнийхээ барааг нэмээрэй."
          action={
            <Button asChild>
              <Link href="/admin/extras/new">Бараа нэмэх</Link>
            </Button>
          }
        />
      ) : (
        <ExtrasAdminList
          extras={extras}
          categories={categories}
          activeCategory={active}
        />
      )}
    </div>
  );
}
