"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { adminFetch } from "@/features/admin/lib/mutate";
import { formatDateTime } from "@/lib/format";
import type { CouponRow } from "@/db/types";
import type { AdminRedemption } from "@/app/api/admin/coupons/[id]/redemptions/route";

/**
 * Who used a coupon, in full (0104). Personal coupons can be shared, so the
 * owner column on the table no longer says who spent it — this does.
 */
export function CouponRedemptionsSheet({
  coupon,
  ownerName,
  onOpenChange,
}: {
  coupon: CouponRow | null;
  ownerName: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [rows, setRows] = React.useState<AdminRedemption[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!coupon) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    adminFetch<{ redemptions: AdminRedemption[] }>(
      `/api/admin/coupons/${coupon.id}/redemptions`,
    ).then((res) => {
      if (cancelled) return;
      if (res.ok) setRows(res.data?.redemptions ?? []);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [coupon]);

  return (
    <Sheet open={coupon != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">{coupon?.code}</SheetTitle>
          <SheetDescription>
            {ownerName ? `Эзэмшигч: ${ownerName}` : "Нийтийн купон"}
            {coupon &&
              ` · ${coupon.used_count}${coupon.max_uses ? ` / ${coupon.max_uses}` : ""} ашигласан`}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : rows == null ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Хэн ч ашиглаагүй байна.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="bg-secondary space-y-1 rounded-xl p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name || "Нэргүй"}</span>
                  {r.phone && (
                    <span className="text-muted-foreground">{r.phone}</span>
                  )}
                  {r.userId && coupon?.user_id === r.userId && (
                    <Badge variant="secondary">Эзэмшигч</Badge>
                  )}
                  {r.cancelledAt && (
                    <Badge variant="sale" className="ml-auto">
                      Цуцлагдсан
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {formatDateTime(r.at)}
                  {r.orderId && (
                    <Link
                      href={`/admin/orders/${r.orderId}`}
                      className="text-foreground underline underline-offset-2"
                    >
                      {r.orderNo ?? "Захиалга"}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
