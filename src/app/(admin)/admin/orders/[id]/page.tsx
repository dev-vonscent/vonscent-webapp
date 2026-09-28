import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getOrderDetail } from "@/features/admin/api";
import { getStaffUser } from "@/lib/auth/guard";
import { formatPrice, formatDateTime } from "@/lib/format";
import {
  orderSummaryRows,
  summarySource,
  type OrderSummaryRow,
} from "@/lib/orders/summary";
import { deliveryDayOf, formatDeliveryDay } from "@/lib/time";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
} from "@/lib/constants";
import { OrderStatusControl } from "@/features/admin/components/order-status-control";
import { cn } from "@/lib/utils";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, staff] = await Promise.all([
    getOrderDetail(id),
    getStaffUser(),
  ]);
  if (!detail) notFound();
  const { order, items, history, customer, payments } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Захиалгууд
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">
            {order.order_no}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatDateTime(order.created_at)} · Хүргэх:{" "}
            <span className="text-foreground font-medium">
              {formatDeliveryDay(deliveryDayOf(order))}
            </span>
          </p>
        </div>
        {/* The order's state is read at a glance from here, so it is sized
            like a headline rather than a list chip. */}
        <Badge
          className={cn(
            "px-4 py-1.5 text-sm md:text-base",
            ORDER_STATUS_STYLE[order.status],
          )}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="[&>div:nth-child(even)]:bg-muted/40 p-0">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between gap-3 p-4 text-sm"
                >
                  <span>
                    {i.brand} {i.product_name} · {i.ml}ml × {i.qty}
                    {i.is_sample && (
                      /* Not "Sample": 2ml is an ordinary paid size in this shop.
                         This flag marks the free 1ml gift line. */
                      <Badge variant="secondary" className="ml-2">
                        Бэлэг
                      </Badge>
                    )}
                  </span>
                  <span className="font-medium">
                    {formatPrice((i.list_price ?? i.unit_price) * i.qty)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <h2 className="font-medium">Хэрэглэгч ба хаяг</h2>
              <p>
                {order.contact_name} · {order.contact_phone}
                {order.contact_email ? ` · ${order.contact_email}` : ""}
              </p>
              <p className="text-muted-foreground">
                {order.ship_city}
                {order.ship_district ? `, ${order.ship_district}` : ""},{" "}
                {order.ship_detail}{" "}
                {order.ship_zone ? `(${order.ship_zone})` : ""}
              </p>
              {customer && (
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="text-gold-strong hover:underline"
                >
                  Бүртгэлтэй хэрэглэгчийн профайл →
                </Link>
              )}
              {order.note && (
                <p className="text-muted-foreground">Тэмдэглэл: {order.note}</p>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-medium">Төлвийн түүх</h2>
                <ol className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-sm">
                      <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                      <div>
                        <p className="font-medium">
                          {ORDER_STATUS_LABEL[h.status]}
                        </p>
                        {h.note && (
                          <p className="text-muted-foreground">{h.note}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {formatDateTime(h.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-5 text-sm">
              <h2 className="font-medium">Дүн</h2>
              {/* Дараалал нь мөнгө хөдөлсний дараалал: барааны дүн → хасагдах
                  нь → нэмэгдэх хүргэлт → төлсөн дүн. Захиалгын тойм,
                  төлбөрийн хуудас, и-мэйл гурав нь энэ дараалалтай нэг мөр. */}
              {orderSummaryRows(summarySource(order)).map((row) => (
                <Row key={row.label} {...row} />
              ))}
              <Separator />
              <div className="flex justify-between gap-3 font-semibold">
                <span>Нийт төлөх</span>
                <span className="tabular-nums">{formatPrice(order.total)}</span>
              </div>
              <Badge
                variant={order.payment_status === "paid" ? "new" : "secondary"}
              >
                {PAYMENT_STATUS_LABEL[order.payment_status]}
              </Badge>

              {/* QPay-ийн гүйлгээ (0089). Буцаалт нь гараар хийгддэг —
                  QPay-ийн refund API зөвхөн картын гүйлгээнд ажилладаг —
                  тул оператор энэ дугаараар мерчант порталаас хайна.
                  Мөн «би төлсөн» гэсэн маргааны цорын ганц нотолгоо. */}
              {payments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-muted-foreground text-xs">QPay гүйлгээ</p>
                  {payments.map((pmt) => (
                    <div key={pmt.qpay_payment_id} className="text-xs">
                      <p className="font-mono break-all">
                        {pmt.qpay_payment_id}
                      </p>
                      <p className="text-muted-foreground">
                        {formatPrice(pmt.amount)}
                        {pmt.wallet ? ` · ${pmt.wallet}` : ""}
                        {pmt.paid_at ? ` · ${formatDateTime(pmt.paid_at)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-medium">Үйлдэл</h2>
              <OrderStatusControl
                orderId={order.id}
                current={order.status}
                paymentStatus={order.payment_status}
                hasQpayInvoice={Boolean(order.qpay_invoice_id)}
                canRecover={staff?.role === "super_admin"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
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
