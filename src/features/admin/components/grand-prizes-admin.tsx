"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GrandAdminRow } from "@/features/admin/api";
import type { GrandPrizeState } from "@/features/lucky-wheel/types";

const STATE: Record<
  GrandPrizeState,
  { label: string; variant: "gold" | "secondary" | "outline" }
> = {
  choose: { label: "Багц сонгоогүй", variant: "gold" },
  ready: { label: "Дараагийн захиалгад", variant: "gold" },
  in_order: { label: "Захиалгад орсон", variant: "secondary" },
  delivered: { label: "Хүргэгдсэн", variant: "outline" },
  expired: { label: "Хугацаа дууссан", variant: "outline" },
};

const ORDER: GrandPrizeState[] = [
  "choose",
  "ready",
  "in_order",
  "delivered",
  "expired",
];

const GENDER = { male: "Эрэгтэй", female: "Эмэгтэй" } as const;

/**
 * The grand prizes (2ml bundles, 0165) from win to doorstep. Most of the
 * journey runs itself — the customer picks a bundle, it rides with their next
 * order, the order's status settles it. Staff step in only for the edges:
 * hand a prize over outside an order, or give an expired one more time.
 */
export function GrandPrizesAdmin({ rows }: { rows: GrandAdminRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const counts = Object.fromEntries(
    ORDER.map((s) => [s, rows.filter((r) => r.state === s).length]),
  ) as Record<GrandPrizeState, number>;
  // Still needing someone: everything but the settled ones, unless asked.
  const visible = showAll
    ? rows
    : rows.filter((r) => r.state !== "delivered" && r.state !== "expired");

  async function act(id: string, body: Record<string, unknown>, done: string) {
    setBusy(id);
    const ok = await mutateJson(
      "/api/admin/lucky-wheel",
      "PATCH",
      { spinId: id, ...body },
      "Хадгалж чадсангүй",
    );
    setBusy(null);
    if (ok) {
      toast.success(done);
      router.refresh();
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="size-4" />
          Гранд шагнал (нийт {rows.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
        >
          {showAll ? "Зөвхөн хүлээгдэж буй" : "Бүгдийг харах"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ORDER.map((s) => (
          <Card key={s}>
            <CardContent className="p-3">
              <p className="text-muted-foreground text-xs">{STATE[s].label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {counts[s]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {visible.length > 0 && (
        <Card>
          <CardContent className="divide-muted/60 divide-y p-0">
            {visible.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {r.customer}
                    {r.phone && (
                      <span className="text-muted-foreground font-normal">
                        {r.phone}
                      </span>
                    )}
                    <Badge variant={STATE[r.state].variant}>
                      {STATE[r.state].label}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Хожсон {formatDate(r.wonAt)}
                    {r.bundleName && (
                      <>
                        {" · "}
                        {r.gender ? `${GENDER[r.gender]}: ` : ""}
                        {r.bundleName}
                      </>
                    )}
                    {r.orderNo && r.orderId && (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/orders/${r.orderId}`}
                          className="text-foreground underline underline-offset-4"
                        >
                          {r.orderNo}
                        </Link>
                      </>
                    )}
                    {r.expiresAt &&
                      (r.state === "choose" ||
                        r.state === "ready" ||
                        r.state === "expired") && (
                        <span
                          className={cn(
                            r.state === "expired" && "text-destructive",
                          )}
                        >
                          {" · "}
                          {r.state === "expired" ? "Дууссан" : "Дуусах"}{" "}
                          {formatDate(r.expiresAt)}
                        </span>
                      )}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {r.state === "expired" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() =>
                        act(r.id, { extend: true }, "14 хоногоор сунгалаа")
                      }
                    >
                      {busy === r.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CalendarPlus className="size-4" />
                      )}
                      Сунгах
                    </Button>
                  )}
                  {(r.state === "choose" || r.state === "ready") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      title="Захиалгаас гадуур гардуулсан бол"
                      onClick={() =>
                        act(
                          r.id,
                          { fulfilled: true },
                          "Хүргэсэн гэж тэмдэглэлээ",
                        )
                      }
                    >
                      {busy === r.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Гараар хүргэсэн
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
