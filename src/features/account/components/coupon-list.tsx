"use client";

import * as React from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/browser";
import { groupCoupons, type CouponGroup, type CouponRecord } from "./coupons";
import { STUB_RATIO, TicketOutline, couponLabel } from "./coupon-ticket";

/**
 * "Идэвхтэй купонууд" on the account page.
 *
 * A wall of tickets, two across, each showing only what it is worth. Codes,
 * minimums and expiry dates all live one tap away on the coupon's own page:
 * at this size they turned every card into a paragraph, and a customer
 * scanning their wallet is asking "what have I got?", not "what are the terms
 * of the third one?".
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
    // RLS narrows this to public coupons plus the ones issued to this
    // customer — someone else's personal code never reaches the browser.
    supabase
      .from("coupons")
      .select(
        "id, code, type, value, min_subtotal, ends_at, max_uses, used_count, user_id",
      )
      .eq("is_active", true)
      .then(({ data }) =>
        setGroups(groupCoupons((data as CouponRecord[] | null) ?? [])),
      );
  }, []);

  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.coupons.length, 0);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Ticket className="text-gold-strong size-4" />
          <h2 className="font-serif text-lg font-semibold">
            Идэвхтэй купонууд
          </h2>
          <span className="text-muted-foreground ml-auto text-xs">
            {total} ширхэг
          </span>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {groups.map((g) => (
            <li key={g.key}>
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

  return (
    <Link
      href={`/account/coupons/${encodeURIComponent(lead.code)}`}
      aria-label={`${couponLabel(group.type, group.value)} купон`}
      className="text-muted-foreground hover:text-gold-strong relative block aspect-video transition-colors"
    >
      <TicketOutline />

      {/* Centred in the ticket body, not the whole card — the stub is dead
          space and a label centred over the card sits off to the left of it. */}
      <span
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{ left: `${STUB_RATIO * 100}%` }}
      >
        <span className="text-foreground font-serif text-2xl font-semibold sm:text-3xl">
          {couponLabel(group.type, group.value)}
        </span>
      </span>

      {count > 1 && (
        <span className="bg-foreground text-background absolute top-2 right-2 rounded-full px-1.5 py-px text-[10px] font-semibold">
          ×{count}
        </span>
      )}
    </Link>
  );
}
