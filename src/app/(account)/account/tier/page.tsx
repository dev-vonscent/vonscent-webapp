import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { TierPage } from "@/features/tiers/components/tier-page";

/**
 * `/account/tier` — хэрэглэгчийн түвшин (0138, feature flag `user_tiers`).
 * Бүх утга нь хэрэглэгч тус бүрийнх тул клиент дээр `/api/account/tier`-оос.
 */
export const metadata: Metadata = {
  title: "Хэрэглэгчийн түвшин",
  robots: { index: false, follow: false },
};

export default async function AccountTierPage() {
  if (!(await isFeatureEnabled("user_tiers"))) notFound();
  return <TierPage />;
}
