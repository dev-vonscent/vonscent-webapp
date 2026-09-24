import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getOrderStatusByToken } from "@/features/order-lookup/api";
import { formatPrice, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  RESERVE_TIMEOUT_MINUTES,
} from "@/lib/constants";
import { deliveryDayOf, formatDeliveryDay, DISPATCH_HOUR } from "@/lib/time";
import { cn } from "@/lib/utils";
import { orderSummaryRows, type OrderSummaryRow } from "@/lib/orders/summary";

/**
 * `/order/<token>` — захиалгын төлөв, нэвтрэхгүйгээр.
 *
 * Яагаад байх ёстой вэ: зочин хэрэглэгч `/account/orders` руу орж чадахгүй
 * бөгөөд `/pay/<token>`-оос гарчихвал өмнө нь буцах ямар ч зам байгаагүй —
 * захиалга 30 минутын дараа чимээгүй цуцлагдаж, төлөх гэж байсан хүн
 * сайтыг эвдэрсэн гэж үздэг байв.
 *
 * Токен нь `/pay/<token>`-тэй ижил: 128 бит санамсаргүй (`orders.pay_token`,
 * 0068). Тиймээс нууцлалын дүрэм ч ижил — линк дамжиж болох тул **хүлээн
 * авагчийн нэр, утас, хаяг энд ХАРАГДАХГҮЙ**.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Захиалгын төлөв",
  robots: { index: false, follow: false },
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderStatusByToken(token);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
          Захиалгын төлөв
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold">
              {order.orderNo}
            </h1>
            <p className="text-muted-foreground text-sm">
              {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={cn("gap-1", ORDER_STATUS_STYLE[order.status])}>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
            {order.paymentStatus !== "paid" && order.status !== "cancelled" && (
              <Badge className="bg-amber-500/15 text-amber-500">
                {PAYMENT_STATUS_LABEL[order.paymentStatus]}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Төлбөр хүлээж буй бол энэ хуудасны цорын ганц зорилго нь төлүүлэх. */}
      {order.awaitingPayment && order.payToken && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm">
              Энэ захиалгын төлбөр хараахан хийгдээгүй байна. Барааг тань{" "}
              {RESERVE_TIMEOUT_MINUTES} минут нөөцөлж байгаа — энэ хугацаанд
              төлбөр хийгдээгүй бол захиалга цуцлагдаж, бараа дэлгүүрт буцна.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href={`/pay/${order.payToken}`}>Төлбөр төлөх</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status === "cancelled" && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm">
              Энэ захиалга цуцлагдсан байна. Шалтгаан тодорхойгүй бол бидэнтэй
              холбогдоно уу.
            </p>
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href="/contact">Бидэнтэй холбогдох</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Хүргэх өдөр — цуцлагдсан захиалгад утгагүй. */}
      {order.status !== "cancelled" && (
        <Card>
          <CardContent className="p-5 text-sm">
            <span className="text-muted-foreground">Хүргэх өдөр: </span>
            <span className="font-medium">
              {formatDeliveryDay(
                deliveryDayOf({
                  created_at: order.createdAt,
                  deliver_on: order.deliverOn,
                }),
              )}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {DISPATCH_HOUR}:00 цагт гарна
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-border divide-y p-0">
          {order.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-3 p-4 text-sm">
              <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-xl">
                {l.image ? (
                  <Image
                    src={l.image}
                    alt={l.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <Package className="text-muted-foreground size-5" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {l.brand} {l.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {l.ml}ml × {l.qty}
                  {l.collectionName ? ` · ${l.collectionName}` : ""}
                </p>
              </div>
              {l.isSample ? (
                <Badge variant="secondary" className="shrink-0">
                  Бэлэг
                </Badge>
              ) : (
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPrice(l.baseTotal)}
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          {orderSummaryRows(order).map((row) => (
            <Row key={row.label} {...row} />
          ))}
          <Separator />
          <div className="flex justify-between gap-3 font-semibold">
            <span>Нийт төлөх</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      {order.history.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-medium">Явц</h2>
            {order.history.map((h, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <span>{h.note || ORDER_STATUS_LABEL[h.status]}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatDateTime(h.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-muted-foreground text-center text-xs">
        Асуух зүйл байвал{" "}
        <Link href="/contact" className="text-gold-strong underline">
          бидэнтэй холбогдоно уу
        </Link>
        .
      </p>
    </div>
  );
}

function Row({ label, value, credit, strong }: OrderSummaryRow) {
  return (
    <div className="flex justify-between gap-3">
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={cn("tabular-nums", credit && "text-success")}>
        {value}
      </span>
    </div>
  );
}
