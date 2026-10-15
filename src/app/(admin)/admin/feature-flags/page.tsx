import { getFeatureFlagRows } from "@/features/admin/api";
import { FeatureFlagManager } from "@/features/admin/components/feature-flag-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getStaffUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Feature flag" };

/**
 * Feature flag (0133) — шинэ feature-ийг release өдөр нээх унтраалга.
 *
 * Сан тус бүрт тусдаа: dev админаас асаавал зөвхөн dev (клиентийн туршилт),
 * prod-д нөлөөгүй. Солих эрх зөвхөн super_admin-д; operator харж л чадна.
 */
export default async function AdminFeatureFlagsPage() {
  const [{ rows, migrated }, staff] = await Promise.all([
    getFeatureFlagRows(),
    getStaffUser(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature flag"
        description="Шинэ боломжийг бүх хэрэглэгчид нээх, хаах. Асаасан даруйд дэлгүүр дээр харагдана."
      />
      <FeatureFlagManager
        rows={rows}
        migrated={migrated}
        canEdit={staff?.role === "super_admin"}
        environment={process.env.VERCEL_ENV ?? "development"}
      />
    </div>
  );
}
