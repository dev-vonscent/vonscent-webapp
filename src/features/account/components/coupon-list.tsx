"use client";

import * as React from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  daysLeft,
  groupCoupons,
  type CouponGroup,
  type CouponRecord,
} from "./coupons";
import {
  STUB_RATIO,
  TicketOutline,
  TicketStub,
  couponLabel,
} from "./coupon-ticket";

/**
 * "Миний купонууд" on the account page.
 *
 * A wall of tickets, two across, each showing only what it is worth. Codes,
 * minimums and expiry dates all live one tap away on the coupon's own page:
 * at this size they turned every card into a paragraph, and a customer
 * scanning their wallet is asking "what have I got?", not "what are the terms
 * of the third one?".
 *
 * Only coupons issued to this customer are listed. RLS also lets through the
 * shop-wide campaign coupons (user_id null), and showing those here read as
 * "someone else's coupon in my wallet" — a customer cannot tell from a ticket
 * whether it was meant for them. Campaign offers still reach the cart on their
 * own, through /api/coupons/available at checkout; this section is the wallet.
 *
 * The list also has to survive the lucky wheel letting coupons accumulate
 * (docs/lucky-wheel.md §0 №1) — `coupons.ts` drops spent codes, which
 * `is_active` alone does not, and collapses identical offers into one card.
 */
export function CouponList() {
  const [groups, setGroups] = React.useState<CouponGroup[]>([]);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      // user_id-аар нарийсгав: RLS нь нийтийн купоныг ч гаргадаг, харин энэ
      // хэсэг бол зөвхөн тухайн хүнд өгсөн купоны хэтэвч.
      const { data: rows } = await supabase
        .from("coupons")
        .select(
          "id, code, type, value, min_subtotal, ends_at, max_uses, used_count, user_id",
        )
        .eq("is_active", true)
        .eq("user_id", data.user.id);
      if (cancelled) return;
      setGroups(groupCoupons((rows as CouponRecord[] | null) ?? []));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.coupons.length, 0);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Ticket className="text-muted-foreground size-4" />
          <h2 className="font-serif text-lg font-semibold">Миний купонууд</h2>
          <span className="text-muted-foreground ml-auto text-xs">
            {total} ширхэг
          </span>
        </div>

        {/* Тасалбар нь өөрийн байгалийн хэмжээтэй объект — багана дүүргэхээр
            татаж томруулбал (нэг купонтой үед 3 баганын өргөнтэй болно) хоосон
            цагаан хавтан шиг харагдана. Тул дээд өргөнийг хааж, зүүн тийш
            эгнүүлэв. */}
        <ul className="flex flex-wrap gap-3">
          {groups.map((g) => (
            <li key={g.key} className="w-[calc(50%-0.375rem)] max-w-44">
              <TicketCard group={g} />
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-xs">
          Нэг захиалгад нэг купон.{" "}
          <Link href="/lucky-wheel" className="hover:text-foreground underline">
            Азын хүрд
          </Link>{" "}
          эргүүлж шинийг аваарай.
        </p>
      </CardContent>
    </Card>
  );
}

function TicketCard({ group }: { group: CouponGroup }) {
  const lead = group.coupons[0];
  const count = group.coupons.length;
  const days = daysLeft(lead.ends_at);

  // Хоёрдогч мөр нэг л зүйл хэлнэ: дуусах нь дөхсөн бол хугацаа, үгүй бол
  // доод хязгаар. Хоёуланг нь бичвэл тасалбар нь нөхцөлийн жагсаалт болно.
  const note =
    days != null && days <= 7
      ? days <= 1
        ? "өнөөдөр дуусна"
        : `${days} хоног үлдсэн`
      : group.minSubtotal > 0
        ? `${formatPrice(group.minSubtotal)}-өөс`
        : null;
  // Анхаарлыг өнгөөр биш, тодролоор хэлнэ — тасалбар саармаг байх ёстой.
  const urgent = days != null && days <= 3;

  return (
    <Link
      href={`/account/coupons/${encodeURIComponent(lead.code)}`}
      aria-label={`${couponLabel(group.type, group.value)} купон`}
      className="text-muted-foreground/50 hover:text-muted-foreground relative block aspect-video transition-[color,transform] duration-300 hover:-translate-y-0.5"
    >
      <TicketOutline />

      <TicketStub className="text-muted-foreground/70" />

      {/* Centred in the ticket body, not the whole card — the stub is dead
          space and a label centred over the card sits off to the left of it. */}
      <span
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center"
        style={{ left: `${STUB_RATIO * 100}%` }}
      >
        <span className="text-foreground font-serif text-xl leading-none font-semibold sm:text-2xl">
          {couponLabel(group.type, group.value)}
        </span>
        {note && (
          <span
            className={cn(
              "mt-1 text-[10px] leading-none",
              urgent ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {note}
          </span>
        )}
      </span>

      {count > 1 && (
        <span className="bg-foreground text-background absolute top-2 right-2 rounded-full px-1.5 py-px text-[10px] font-semibold">
          ×{count}
        </span>
      )}
    </Link>
  );
}
