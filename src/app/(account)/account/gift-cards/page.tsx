import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Gift, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountPageHeader } from "@/features/account/components/account-page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getMyGiftCards } from "@/features/gift-cards/server";
import { GiftCardCodeForm } from "@/features/gift-cards/components/gift-card-redeem";
import { MyGiftCardItem } from "@/features/gift-cards/components/my-gift-card";
import { giftUrl } from "@/features/gift-cards/lib";
import type { MyGiftCard } from "@/features/gift-cards/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Бэлгийн карт",
  robots: { index: false, follow: false },
};

function CardGrid({ cards }: { cards: MyGiftCard[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
      {cards.map((c) => (
        <MyGiftCardItem
          key={c.id}
          card={c}
          url={c.token && c.code ? giftUrl(c.token, env.siteUrl) : null}
        />
      ))}
    </ul>
  );
}

function SectionTitle({
  id,
  children,
  count,
}: {
  id: string;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <h2 id={id} className="flex items-baseline gap-2 text-lg font-semibold">
      {children}
      <span className="text-muted-foreground text-sm font-normal tabular-nums">
        {count}
      </span>
    </h2>
  );
}

/**
 * «Бэлгийн карт» (gift-cards-plan §2.2) — код оруулах, миний илгээсэн
 * (эргүүлж кодоо харна, хуваалцана), надад ирсэн. Туг хаалттай бол 404.
 */
export default async function AccountGiftCardsPage() {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) redirect("/login?next=%2Faccount%2Fgift-cards");

  const cards = await getMyGiftCards(user.id);
  // Ашиглагдаагүй нь эхэнд — хуваалцах, илгээх ажил тэдэн дээр л үлдсэн.
  const rank = (c: MyGiftCard) => (c.status === "active" ? 0 : 1);
  const bought = cards
    .filter((c) => c.role === "bought")
    .sort((a, b) => rank(a) - rank(b));
  const received = cards.filter((c) => c.role === "received");

  return (
    <div className="space-y-10">
      <AccountPageHeader
        title="Бэлгийн карт"
        aside={
          <Button asChild size="sm" variant="secondary">
            <Link href="/gift-cards">Карт худалдаж авах</Link>
          </Button>
        }
      />

      <section
        aria-labelledby="gift-redeem"
        className="bg-secondary flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center md:gap-8"
      >
        <div className="flex gap-3 md:w-72 md:shrink-0">
          <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-full">
            <Ticket className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="gift-redeem" className="font-semibold">
              Танд код ирсэн үү?
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Кодоо оруулбал картын дүн V point болж дансанд орно.
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <GiftCardCodeForm />
        </div>
      </section>

      <section aria-labelledby="gift-bought" className="space-y-4">
        <SectionTitle id="gift-bought" count={bought.length}>
          Миний илгээсэн
        </SectionTitle>
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
          <>
            {bought.some((c) => c.code) && (
              <p className="text-muted-foreground -mt-2 text-sm">
                Карт дээр дарж эргүүлбэл код, QR нь харагдана.
              </p>
            )}
            <CardGrid cards={bought} />
          </>
        )}
      </section>

      {received.length > 0 && (
        <section aria-labelledby="gift-received" className="space-y-4">
          <SectionTitle id="gift-received" count={received.length}>
            Надад ирсэн
          </SectionTitle>
          <CardGrid cards={received} />
        </section>
      )}
    </div>
  );
}
