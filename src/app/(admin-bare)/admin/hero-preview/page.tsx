import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { HeroPreviewFrame } from "@/features/heroes/components/hero-preview-frame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hero урьдчилж харах",
  robots: { index: false, follow: false },
};

/**
 * Админы hero маягтын iframe (plan §7.4): ЖИНХЭНЭ `CampaignHero`-г тухайн
 * iframe-ийн өргөнөөр (390 / 768 / 1440) зурна — breakpoint нь viewport-оор
 * ажилладаг тул контейнерийн өргөнөөр биш, iframe хэрэгтэй. Админы shell-гүй
 * (тусдаа route group). Өгөгдлийг эх цонх `postMessage`-оор илгээнэ.
 */
export default async function HeroPreviewPage() {
  if (!(await isFeatureEnabled("hero_admin"))) notFound();
  if (!(await getStaffUser())) notFound();
  return <HeroPreviewFrame />;
}
