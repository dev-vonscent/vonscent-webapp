import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkSeen } from "@/components/shared/mark-seen";
import { pageMetadata } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getGiftCardDesigns } from "@/features/gift-cards/server";
import { GiftCardPurchase } from "@/features/gift-cards/components/gift-card-purchase";
import { GiftCardSteps } from "@/features/gift-cards/components/gift-card-steps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata("/gift-cards"),
  title: "Бэлгийн карт",
  description:
    "Хайртай хүндээ үнэрийн сонголтыг бэлэглээрэй — 100,000₮-өөс эхэлсэн бэлгийн карт, имэйлээр шууд очно.",
};

/**
 * «Бэлгийн карт» (gift-cards-plan §2.1). Туг `gift_cards` хаалттай бол 404.
 * Зочин бүгдийг харна; төлбөрийн өмнө нэвтэрнэ (§12-Q1).
 */
export default async function GiftCardsPage() {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const designs = await getGiftCardDesigns();
  if (designs.length === 0) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <MarkSeen seenKey="gift-cards" />
      <header className="mb-8 max-w-2xl">
        <h1 data-page-title className="text-3xl font-semibold tracking-tight">
          Бэлгийн карт
        </h1>
        <p className="text-muted-foreground mt-2">
          Үнэр бол хамгийн хувийн бэлэг. Сонголтыг нь өөрт нь үлдээгээрэй —
          тэр хүн хүссэн үнэртнээ өөрөө сонгоно.
        </p>
      </header>
      <GiftCardPurchase designs={designs} />
      <section className="mt-16" aria-labelledby="gift-steps">
        <h2 id="gift-steps" className="text-xl font-semibold tracking-tight">
          Хүлээн авагч яаж ашиглах вэ
        </h2>
        <GiftCardSteps className="mt-4" />
      </section>
    </div>
  );
}
