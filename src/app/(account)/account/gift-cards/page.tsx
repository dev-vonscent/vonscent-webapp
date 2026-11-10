import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountPageHeader } from "@/features/account/components/account-page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { getMyGiftCards } from "@/features/gift-cards/server";
import { GiftCardFace } from "@/features/gift-cards/components/gift-card-face";
import { GiftCardCodeForm } from "@/features/gift-cards/components/gift-card-redeem";
import { GiftCardShare } from "@/features/gift-cards/components/gift-card-share";
import { GiftCardSendButton } from "@/features/gift-cards/components/gift-card-send";
import {
  GIFT_STATUS_LABEL,
  formatGiftAmount,
  giftUrl,
} from "@/features/gift-cards/lib";
import type { MyGiftCard } from "@/features/gift-cards/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Бэлгийн карт",
  robots: { index: false, follow: false },
};

function BoughtCard({ card }: { card: MyGiftCard }) {
  return (
    <li className="bg-secondary grid gap-4 rounded-2xl p-4 sm:grid-cols-[220px_minmax(0,1fr)]">
      <GiftCardFace design={card.design} text={card} />
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">
            {card.recipientName} · {formatGiftAmount(card.amount)}
          </p>
          <span className="text-muted-foreground text-xs">
            {GIFT_STATUS_LABEL[card.status]}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {card.status === "redeemed" && card.redeemedAt
            ? `${formatDate(card.redeemedAt)}-нд оноо болгосон.`
            : card.recipientEmail
              ? `${card.recipientEmail} руу ${card.sentAt ? "илгээсэн" : "илгээгдэнэ"}.`
              : "Та өөрөө өгнө — холбоос эсвэл кодоо хуваалцаарай."}
          {card.status === "active" && card.expiresAt
            ? ` ${formatDate(card.expiresAt)} хүртэл хүчинтэй.`
            : ""}
        </p>
        {card.code && card.token && (
          <>
            <GiftCardShare
              code={card.code}
              url={giftUrl(card.token, env.siteUrl)}
              recipientName={card.recipientName}
            />
            <GiftCardSendButton
              cardId={card.id}
              currentEmail={card.recipientEmail}
              sent={Boolean(card.sentAt)}
            />
          </>
        )}
      </div>
    </li>
  );
}

/**
 * «Бэлгийн карт» (gift-cards-plan §2.2) — код оруулах, миний худалдаж авсан
 * (хуваалцах), хүлээн авсан картууд. Туг хаалттай бол 404.
 */
export default async function AccountGiftCardsPage() {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) redirect("/login?next=%2Faccount%2Fgift-cards");

  const cards = await getMyGiftCards(user.id);
  const bought = cards.filter((c) => c.role === "bought");
  const received = cards.filter((c) => c.role === "received");

  return (
    <div className="space-y-8">
      <AccountPageHeader
        title="Бэлгийн карт"
        aside={
          <Button asChild size="sm" variant="secondary">
            <Link href="/gift-cards">Карт худалдаж авах</Link>
          </Button>
        }
      />

      <section className="bg-secondary rounded-2xl p-5">
        <h2 className="font-semibold">Бэлгийн код оруулах</h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm">
          Танд ирсэн кодыг оруулбал картын дүн V point болж дансанд орно.
        </p>
        <GiftCardCodeForm />
      </section>

      <section aria-labelledby="gift-bought" className="space-y-3">
        <h2 id="gift-bought" className="text-lg font-semibold">
          Миний илгээсэн
        </h2>
        {bought.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="Одоогоор бэлгийн карт аваагүй байна"
            description="Хайртай хүндээ үнэрийн сонголтыг бэлэглээрэй."
            action={
              <Button asChild>
                <Link href="/gift-cards">Бэлгийн карт сонгох</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {bought.map((c) => (
              <BoughtCard key={c.id} card={c} />
            ))}
          </ul>
        )}
      </section>

      {received.length > 0 && (
        <section aria-labelledby="gift-received" className="space-y-3">
          <h2 id="gift-received" className="text-lg font-semibold">
            Надад ирсэн
          </h2>
          <ul className="space-y-3">
            {received.map((c) => (
              <li
                key={c.id}
                className="bg-secondary grid gap-4 rounded-2xl p-4 sm:grid-cols-[220px_minmax(0,1fr)]"
              >
                <GiftCardFace design={c.design} text={c} />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Илгээгч: {c.fromName} · {formatGiftAmount(c.amount)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {c.redeemedAt ? `${formatDate(c.redeemedAt)}-нд ` : ""}
                    {(c.points ?? c.amount).toLocaleString("mn-MN")} V point
                    дансанд орсон.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
