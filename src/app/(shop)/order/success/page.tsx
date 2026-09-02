"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/format";
import { trackPurchase } from "@/lib/analytics";
import {
  DISPATCH_HOUR,
  ORDER_EDIT_CUTOFF_HOUR,
  earliestDeliveryDay,
  formatDeliveryDay,
} from "@/lib/time";

interface QpayInfo {
  invoiceId: string;
  qrText: string;
  qrImage: string | null;
}

interface LastOrder {
  orderNo: string;
  total: number;
  paymentMethod: "qpay" | "bank_transfer";
  contactName: string;
  /** "yyyy-MM-dd" (UB) — chosen at checkout; absent on a pre-E1 session. */
  deliverOn?: string | null;
  qpay?: QpayInfo | null;
  qpayMock?: boolean;
}

const BANK = {
  bank: "Хаан банк",
  account: "5000 1234 5678",
  holder: "Вонсэнт ХХК",
};

export default function OrderSuccessPage() {
  const [order, setOrder] = React.useState<LastOrder | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const raw = sessionStorage.getItem("vonscent-last-order");
    if (raw) setOrder(JSON.parse(raw));
    setLoaded(true);
  }, []);

  // Poll the real payment status while the (non-mock) QPay QR is on screen —
  // this is what flips the page to "Төлбөр амжилттай" for genuine payments
  // and lets the purchase event below fire outside mock mode (audit №25).
  React.useEffect(() => {
    if (!order || paid) return;
    if (order.paymentMethod !== "qpay" || order.qpayMock) return;
    let cancelled = false;
    const startedAt = Date.now();
    const t = setInterval(async () => {
      // Give up after 10 minutes — the invoice window is long gone by then.
      if (Date.now() - startedAt > 10 * 60_000) {
        clearInterval(t);
        return;
      }
      try {
        const res = await fetch(
          `/api/payments/status?order=${encodeURIComponent(order.orderNo)}`,
        );
        const data = await res.json();
        if (!cancelled && data?.paid) {
          setPaid(true);
          clearInterval(t);
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [order, paid]);

  // Purchase event — only once the payment is actually confirmed (an unpaid
  // QPay invoice on this page is an abandoned checkout, not a purchase).
  React.useEffect(() => {
    if (!order || !paid) return;
    const key = `vonscent-purchase-${order.orderNo}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked — fire anyway, worst case a duplicate event
    }
    trackPurchase(order.orderNo, [], order.total);
  }, [order, paid]);

  async function confirmMockPayment() {
    if (!order) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch("/api/payments/qpay/mock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: order.orderNo }),
      });
      if (!res.ok) {
        setConfirmError("Төлбөр баталгаажуулахад алдаа гарлаа.");
        return;
      }
      setPaid(true);
    } finally {
      setConfirming(false);
    }
  }

  if (!loaded) return <div className="mx-auto max-w-xl px-4 py-24 md:px-8" />;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center md:px-8">
        <h1 className="font-serif text-2xl font-semibold">
          Захиалга олдсонгүй
        </h1>
        <Button asChild className="mt-6">
          <Link href="/catalog">Дэлгүүр рүү буцах</Link>
        </Button>
      </div>
    );
  }

  const showQpayMock = order.paymentMethod === "qpay" && order.qpayMock;
  const qpay = order.qpay;
  const showQpayInvoice = order.paymentMethod === "qpay" && qpay;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 md:px-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="text-success size-14" />
        <h1 className="font-serif text-3xl font-semibold">
          {paid ? "Төлбөр амжилттай" : "Захиалга баталгаажлаа"}
        </h1>
        <p className="text-muted-foreground">
          {paid
            ? "Таны төлбөр баталгаажлаа. Бид захиалгыг боловсруулж эхэлнэ."
            : `Баярлалаа, ${order.contactName}! ${showQpayMock ? "Доорх mock QPay-ээр төлбөрөө баталгаажуулна уу." : "Бид тантай удахгүй холбогдоно."}`}
        </p>
        <p className="text-muted-foreground text-sm">
          Захиалга{" "}
          <strong className="text-foreground">
            {formatDeliveryDay(order.deliverOn ?? earliestDeliveryDay())}
          </strong>{" "}
          {DISPATCH_HOUR}:00 цагт хүргэлтэд гарна (амралтын өдөр ч хүргэнэ). Тэр
          өдрийн өглөөний {ORDER_EDIT_CUTOFF_HOUR}:00 цаг хүртэл цуцлах
          боломжтой.
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

          <Separator />

          {order.paymentMethod === "bank_transfer" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Төлбөрийн заавар</p>
              <p className="text-muted-foreground text-sm">
                Доорх дансанд шилжүүлэг хийж, гүйлгээний утга дээр захиалгын
                дугаараа бичнэ үү.
              </p>
              <div className="bg-secondary rounded-md p-4 text-sm">
                <Row label="Банк" value={BANK.bank} />
                <Row label="Данс" value={BANK.account} copy />
                <Row label="Хүлээн авагч" value={BANK.holder} />
                <Row label="Гүйлгээний утга" value={order.orderNo} copy />
              </div>
            </div>
          ) : showQpayInvoice ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">QPay-ээр төлөх</p>
                  {showQpayMock && (
                    <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                      Mock
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {showQpayMock
                    ? "Хөгжүүлэлтийн орчин — доорх товчоор QPay төлбөрийг симуляц хийнэ."
                    : "QPay QR кодоор төлнө үү. Төлбөр баталгаажмагц захиалга боловсруулагдана."}
                </p>
              </div>

              {qpay.qrImage && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qpay.qrImage}
                    alt="QPay QR код"
                    width={200}
                    height={200}
                    className="border-border rounded-md border"
                  />
                </div>
              )}

              <div className="bg-secondary rounded-md p-3 text-xs">
                <Row label="Invoice ID" value={qpay.invoiceId} copy />
              </div>

              {showQpayMock && (
                <div className="space-y-2">
                  {confirmError && (
                    <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                      {confirmError}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={paid || confirming}
                    onClick={confirmMockPayment}
                  >
                    {confirming ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Баталгаажуулж байна…
                      </>
                    ) : paid ? (
                      "Төлбөр баталгаажсан"
                    ) : (
                      "Төлбөр баталгаажуулах (mock)"
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">QPay-ээр төлөх</p>
              <p className="text-muted-foreground text-sm">
                QPay QR код таны бүртгэлтэй имэйл болон захиалгын хэсэгт
                илгээгдэнэ. Төлбөр баталгаажмагц захиалга боловсруулагдана.
              </p>
            </div>
          )}
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

function Row({
  label,
  value,
  copy,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        {value}
        {copy && (
          <button
            onClick={() => navigator.clipboard?.writeText(value)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Хуулах"
          >
            <Copy className="size-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}
