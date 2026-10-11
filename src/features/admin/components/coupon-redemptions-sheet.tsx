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
import { formatDateTime, formatPrice } from "@/lib/format";
import { summarizeRedemptions } from "@/features/admin/lib/redemption-summary";
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
  const [truncated, setTruncated] = React.useState(false);

  React.useEffect(() => {
    if (!coupon) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    adminFetch<{ redemptions: AdminRedemption[]; truncated?: boolean }>(
      `/api/admin/coupons/${coupon.id}/redemptions`,
    ).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setRows(res.data?.redemptions ?? []);
        setTruncated(res.data?.truncated === true);
      } else setError(res.error);
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
          </SheetDescription>
        </SheetHeader>

        {rows && rows.length > 0 && (
          <RedemptionStats rows={rows} truncated={truncated} />
        )}

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
                {r.discount != null && r.discount > 0 && (
                  <div
                    className={
                      r.cancelledAt
                        ? "text-muted-foreground text-sm tabular-nums line-through"
                        : "text-sm font-medium tabular-nums"
                    }
                  >
                    −{formatPrice(r.discount)}
                  </div>
                )}
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

/**
 * Дээд талын гурван тоо. Цуцлагдсан ашиглалт оролцохгүй (жагсаалтад харагдсаар).
 */
function RedemptionStats({
  rows,
  truncated,
}: {
  rows: AdminRedemption[];
  truncated: boolean;
}) {
  const s = summarizeRedemptions(rows);
  const stats = [
    { value: `${s.uses} удаа`, label: "ашигласан" },
    { value: `${s.people} хүн`, label: "ашигласан" },
    { value: formatPrice(s.discount), label: "нийт хөнгөлөлт" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((st) => (
          <div
            key={st.label + st.value}
            className="bg-secondary rounded-xl p-3"
          >
            <p className="text-base font-semibold tabular-nums">{st.value}</p>
            <p className="text-muted-foreground text-xs">{st.label}</p>
          </div>
        ))}
      </div>
      {truncated && (
        <p className="text-muted-foreground text-xs">
          Сүүлийн 500 ашиглалтаар тооцов.
        </p>
      )}
    </div>
  );
}
