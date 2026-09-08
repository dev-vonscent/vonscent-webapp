"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import {
  DISPATCH_HOUR,
  earliestDeliveryDay,
  formatDeliveryDay,
} from "@/lib/time";

/**
 * Demo-mode confirmation.
 *
 * Real orders never land here — checkout sends them to `/pay/<token>`, which
 * is where payment happens and where the order becomes confirmed. This page
 * only covers the no-database demo build, which issues no pay token because
 * there is nothing to pay.
 */
interface DemoOrder {
  orderNo: string;
  total: number;
  paymentMethod: "qpay" | "bank_transfer";
  contactName: string;
  deliverOn?: string | null;
}

export default function OrderSuccessPage() {
  const [order, setOrder] = React.useState<DemoOrder | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("vonscent-last-order");
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // malformed or blocked storage — fall through to the empty state
    }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="mx-auto max-w-xl px-4 py-24 md:px-8" />;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center md:px-8">
        <h1 className="font-serif text-2xl font-semibold">
          Захиалга олдсонгүй
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Захиалгынхаа төлөвийг «Захиалгаа хянах» хэсгээс үзнэ үү.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/account/orders">Захиалгаа хянах</Link>
          </Button>
          <Button asChild>
            <Link href="/catalog">Дэлгүүр рүү буцах</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 md:px-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="text-success size-14" />
        <h1 className="font-serif text-3xl font-semibold">
          Захиалга хүлээн авлаа
        </h1>
        <p className="text-muted-foreground">
          Баярлалаа, {order.contactName}! Бид тантай удахгүй холбогдоно.{" "}
          <strong className="text-foreground">
            {formatDeliveryDay(order.deliverOn ?? earliestDeliveryDay())}
          </strong>{" "}
          {DISPATCH_HOUR}:00 цагт хүргэлтэд гарна.
        </p>
      </div>

      <Card className="mt-8">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Захиалгын дугаар
            </span>
            <span className="font-mono font-semibold">{order.orderNo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Нийт дүн</span>
            <span className="font-serif text-lg font-semibold">
              {formatPrice(order.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/account/orders">Захиалга харах</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/catalog">Үргэлжлүүлэх</Link>
        </Button>
      </div>
    </div>
  );
}
