import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getScentFamilies } from "@/features/taxonomy/api";
import { ProfileInfoPage } from "@/features/profile-info/components/profile-info-page";

/**
 * `/account/info` — «Миний мэдээлэл» (0163, feature flag `profile_info`).
 * Утгууд нь хэрэглэгч тус бүрийнх тул клиент дээр `/api/account/profile-info`-оос.
 */
export const metadata: Metadata = {
  title: "Миний мэдээлэл",
  robots: { index: false, follow: false },
};

export default async function AccountInfoPage() {
  if (!(await isFeatureEnabled("profile_info"))) notFound();
  const families = await getScentFamilies();
  return <ProfileInfoPage families={families} />;
}
