"use client";

import * as React from "react";
import Image from "next/image";
import { Sparkles, ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/browser";
import type { LoyaltyLedgerRow } from "@/db/types";

/** Ledger reasons the RPCs write, in the customer's words. */
const REASON_LABEL: Record<string, string> = {
  earn: "Захиалгаас цугларсан",
  redeem: "Захиалгад ашигласан",
  cancel_reverse: "Захиалга цуцлагдсан",
  cancel_pending: "Цуцлагдсан захиалгын оноо",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LoyaltyHistoryPage() {
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
      <h1 className="font-serif text-2xl font-semibold">V point</h1>

      {/* Balance */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image
              src="/v-point.png"
              alt=""
              width={48}
              height={48}
              className="size-full object-cover"
            />
          </span>
          <div>
            <p className="text-3xl font-semibold">{points}</p>
            <p className="text-sm text-muted-foreground">Нийт боломжтой оноо</p>
          </div>
          {/* Points from an order that could still be cancelled aren't
              spendable yet (todo.md B4) — say so rather than letting the
              balance look wrong. */}
          {pending > 0 && (
            <div className="ml-auto text-right">
              <p className="flex items-center justify-end gap-1.5 text-2xl font-semibold text-muted-foreground">
                <Lock className="size-4" />
                {pending}
              </p>
              <p className="text-xs text-muted-foreground">
                Түгжээтэй — хүргэгдсэний дараа нээгдэнэ
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Онооны түүх</h2>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg bg-secondary py-12 text-center">
            <Sparkles className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Онооны хөдөлгөөн одоогоор алга.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => {
              const earned = e.delta >= 0;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-4 rounded-xl bg-card p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
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
                    <p className="text-xs text-muted-foreground">
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
