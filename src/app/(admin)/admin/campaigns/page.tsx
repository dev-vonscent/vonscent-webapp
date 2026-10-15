import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getCampaignsAdmin } from "@/features/campaigns/api";
import { CampaignAdmin } from "@/features/campaigns/components/campaign-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Кампанит ажил" };

export default async function AdminCampaignsPage() {
  // Туг хаалттай — шууд URL-ээр ч орохгүй (feature flag `campaigns`).
  if (!(await isFeatureEnabled("campaigns"))) notFound();
  const rows = await getCampaignsAdmin();
  return <CampaignAdmin rows={rows} />;
}
