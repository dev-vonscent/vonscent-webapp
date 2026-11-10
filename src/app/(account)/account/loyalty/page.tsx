"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Gift, Lock } from "lucide-react";
import { useFeatureFlag } from "@/components/feature-flags";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/browser";
import type { LoyaltyLedgerRow } from "@/db/types";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountPageHeader } from "@/features/account/components/account-page-header";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { VPointMark } from "@/components/shared/v-point-mark";

/** Ledger reasons the RPCs write, in the customer's words. */
const REASON_LABEL: Record<string, string> = {
  earn: "Захиалгаас цугларсан",
  redeem: "Захиалгад ашигласан",
  cancel_reverse: "Захиалга цуцлагдсан",
  cancel_pending: "Цуцлагдсан захиалгын оноо",
  review: "Сэтгэгдлийн урамшуулал",
  profile: "Мэдээлэл бөглөсний урамшуулал",
  gift_card: "Бэлгийн карт",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LoyaltyHistoryPage() {
  const giftCardsOn = useFeatureFlag("gift_cards");
  const [points, setPoints] = React.useState(0);
  const [pending, setPending] = React.useState(0);
  const [entries, setEntries] = React.useState<LoyaltyLedgerRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoaded(true);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("loyalty_points, pending_points")
        .eq("id", data.user.id)
        .maybeSingle();
      const p = profile as {
        loyalty_points?: number;
        pending_points?: number;
      } | null;
      setPoints(p?.loyalty_points ?? 0);
      setPending(p?.pending_points ?? 0);

      const { data: ledger } = await supabase
        .from("loyalty_ledger")
        .select("*")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false });
      setEntries((ledger as LoyaltyLedgerRow[] | null) ?? []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div className="h-40" />;

  return (
    <div className="space-y-6">
      <AccountPageHeader title="V point" />

      {/* Balance */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <VPointIcon className="text-gold size-12 shrink-0" />
          <div>
            <p className="text-3xl font-semibold">
              {points}
              <VPointMark className="ml-1.5" />
            </p>
            <p className="text-muted-foreground text-sm">Нийт боломжтой оноо</p>
          </div>
          {/* Points from an order that could still be cancelled aren't
              spendable yet (todo.md B4) — say so rather than letting the
              balance look wrong. */}
          {pending > 0 && (
            <div className="ml-auto text-right">
              <p className="text-muted-foreground flex items-center justify-end gap-1.5 text-2xl font-semibold">
                <Lock className="size-4" />
                {/* Тоо, тэмдэг хоёр flex item болж салбал baseline зөрнө —
                    нэг inline мөр дотор байлгана. */}
                <span>
                  {pending}
                  <VPointMark className="ml-1" />
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                Түгжээтэй — хүргэгдсэний дараа нээгдэнэ
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Бэлгийн код (0179) — оноо болгох газар нь «Бэлгийн карт» хуудас. */}
      {giftCardsOn && (
        <Link
          href="/account/gift-cards"
          className="bg-secondary hover:bg-secondary/70 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
        >
          <Gift className="size-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">Бэлгийн код ирсэн үү? Энд оруулж оноо болгоно.</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Онооны түүх</h2>
        {entries.length === 0 ? (
          <EmptyState
            surface="muted"
            size="sm"
            title="Онооны хөдөлгөөн одоогоор алга"
            description="Захиалга төлөгдөх бүрд оноо энд бүртгэгдэнэ."
          />
        ) : (
          <div className="space-y-2">
            {entries.map((e) => {
              const earned = e.delta >= 0;
              return (
                <div
                  key={e.id}
                  className="bg-card flex items-center gap-4 rounded-xl p-4"
                >
                  <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
                    {earned ? (
                      <ArrowUpRight className="size-5" />
                    ) : (
                      <ArrowDownLeft className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {REASON_LABEL[e.reason] ??
                        e.reason ??
                        (earned ? "Оноо хуримтлуулсан" : "Оноо ашигласан")}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(e.created_at)}
                      {e.reason === "earn" && !e.released && " · түгжээтэй"}
                    </p>
                  </div>
                  <span className="ml-auto font-semibold">
                    {earned ? "+" : ""}
                    {e.delta}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
