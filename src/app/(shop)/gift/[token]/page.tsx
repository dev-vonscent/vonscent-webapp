import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { getGiftCardByToken } from "@/features/gift-cards/server";
import { GiftCardFace } from "@/features/gift-cards/components/gift-card-face";
import { GiftCardRedeemAction } from "@/features/gift-cards/components/gift-card-redeem";
import {
  GiftCardFaq,
  GiftCardSteps,
} from "@/features/gift-cards/components/gift-card-steps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Танд бэлэг ирлээ",
  // Token бол эрх — хайлтад, урьдчилан харах зурагт код гарахгүй ч индекслэхгүй.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * `/gift/<token>` — хүлээн авагчийн хуудас (gift-cards-plan §2.3).
 *
 * Хүлээн авагч манай сайтыг мэдэхгүй байх магадлал өндөр: нэг дэлгэцэнд
 * картын зураг, хэнээс, ганц том товч, 3 алхам, FAQ. Нэвтрэлтгүй нээгдэнэ;
 * код энд харагдахгүй (token нь эрх).
 */
export default async function GiftPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const card = await getGiftCardByToken(token, user?.id ?? null);
  if (!card || card.status === "void") notFound();
  // Бэлэг ХЭНИЙ дансанд орохыг товчны дээр хэлнэ — худалдан авагч эсвэл
  // өөр хүний бүртгэлтэй хөтчөөс нээхэд андуурч авахаас сэргийлнэ.
  const viewerName = user
    ? ((
        await supabase!
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle()
      ).data?.full_name ?? null)
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      {/* Нэрэнд тийн ялгал залгахгүй (Болд-оос/Сараа-гаас) — «Илгээгч: …». */}
      <p className="text-muted-foreground text-sm">
        Танд бэлэг ирлээ · Илгээгч:{" "}
        <span className="text-foreground font-medium">{card.fromName}</span>
      </p>
      <h1 data-page-title className="mt-1 text-3xl font-semibold tracking-tight">
        {card.amount.toLocaleString("mn-MN")}₮-ийн бэлгийн карт
      </h1>

      <GiftCardFace
        className="mt-6"
        priority
        design={card.design}
        text={card}
      />

      <div className="mt-6">
        {card.status === "active" && (
          <>
            <GiftCardRedeemAction
              token={card.token}
              amount={card.amount}
              loggedIn={Boolean(user)}
              viewerName={viewerName}
              viewerIsBuyer={card.viewerIsBuyer}
            />
            {card.expiresAt && (
              <p className="text-muted-foreground mt-3 text-center text-xs">
                {formatDate(card.expiresAt)} хүртэл оноо болгох боломжтой. Оноо
                болсны дараа хугацаагүй.
              </p>
            )}
          </>
        )}
        {card.status === "redeemed" && (
          <div className="bg-secondary rounded-2xl p-6 text-center">
            <p className="font-semibold">
              {card.redeemedByViewer
                ? `Та энэ бэлгийг ${card.redeemedAt ? `${formatDate(card.redeemedAt)}-нд ` : ""}хүлээн авсан.`
                : "Энэ бэлгийн карт аль хэдийн оноо болсон байна."}
            </p>
            <Button
              asChild
              className="bg-cta text-cta-foreground hover:bg-cta/90 mt-4"
            >
              <Link href="/catalog">Үнэртэн сонгох</Link>
            </Button>
          </div>
        )}
        {card.status === "expired" && (
          <div className="bg-secondary rounded-2xl p-6 text-center">
            <p className="font-semibold">Энэ бэлгийн картын хугацаа дууссан.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Бидэнтэй холбогдвол шалгаж, боломжтой бол сунгаж өгье.
            </p>
            <Button asChild variant="secondary" className="mt-4">
              <Link href="/contact">Холбоо барих</Link>
            </Button>
          </div>
        )}
      </div>

      {card.status === "active" && (
        <>
          <section className="mt-12" aria-labelledby="gift-how">
            <h2 id="gift-how" className="text-xl font-semibold tracking-tight">
              Хэрхэн ашиглах вэ
            </h2>
            <GiftCardSteps className="mt-4 sm:grid-cols-1" />
          </section>
          <section className="mt-12" aria-labelledby="gift-faq">
            <h2 id="gift-faq" className="text-xl font-semibold tracking-tight">
              Түгээмэл асуулт
            </h2>
            <GiftCardFaq className="mt-2" />
          </section>
        </>
      )}
    </div>
  );
}
