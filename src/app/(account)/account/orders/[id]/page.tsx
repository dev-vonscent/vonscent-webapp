import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/features/products/api";
import { formatPrice, formatDateTime } from "@/lib/format";
import {
  DISPATCH_HOUR,
  deliveryDayOf,
  formatEditCutoff,
  formatDeliveryDay,
  isOrderEditable,
} from "@/lib/time";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
} from "@/lib/constants";
import {
  OrderActions,
  type ReorderItem,
} from "@/features/account/components/order-actions";
import type { OrderRow, OrderItemRow, OrderStatusHistoryRow } from "@/db/types";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: orderData } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const order = orderData as OrderRow | null;
  if (!order) notFound();

  // Мөнгө хүлээж буй захиалга — энэ хуудасны үндсэн үйлдэл нь төлөх болно.
  const awaitingPayment =
    order.payment_status === "unpaid" &&
    order.status !== "cancelled" &&
    Boolean(order.pay_token);

  const [{ data: itemData }, { data: historyData }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const items = (itemData as OrderItemRow[] | null) ?? [];
  const history = (historyData as OrderStatusHistoryRow[] | null) ?? [];

  // Resolve slugs/images for the reorder action.
  const productIds = [
    ...new Set(items.map((i) => i.product_id).filter(Boolean)),
  ] as string[];
  const products = await getProductsByIds(productIds);
  const byId = new Map(products.map((p) => [p.id, p]));

  const reorderItems: ReorderItem[] = items
    .filter((i) => i.product_id && i.variant_id)
    .map((i) => {
      const p = byId.get(i.product_id as string);
      return {
        productId: i.product_id as string,
        slug: p?.slug ?? "",
        name: i.product_name,
        brand: i.brand,
        variantId: i.variant_id as string,
        ml: i.ml,
        unitPrice: i.unit_price,
        image: p?.image?.url ?? null,
        qty: i.qty,
      };
    })
    .filter((i) => i.slug);

  // Cancellable only while the status allows it AND the delivery day has not
  // started yet (cut-off 00:00 UB, client 2026-09-21) — which for a pre-order
  // can be a week or more away.
  const openStatus = order.status === "pending" || order.status === "confirmed";
  const beforeCutoff = isOrderEditable(order);
  const cancellable = openStatus && beforeCutoff;

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="text-muted-foreground hover:text-foreground hidden items-center gap-1 text-sm md:inline-flex"
      >
        <ArrowLeft className="size-4" /> Захиалгууд руу буцах
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">
            {order.order_no}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatDateTime(order.created_at)}
          </p>
        </div>
        <Badge className={ORDER_STATUS_STYLE[order.status]}>
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Items */}
          <Card>
            <CardContent className="divide-border divide-y p-0">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between gap-3 p-4 text-sm"
                >
                  <span>
                    {i.brand} {i.product_name} · {i.ml}ml × {i.qty}
                    {/* «Sample» БИШ: 2ml бол энэ дэлгүүрт энгийн төлбөртэй
                        хэмжээ. `is_sample` нь сар бүрийн 1мл бэлгийн дээжийг
                        л тэмдэглэдэг. Админы хуудсанд аль хэдийн «Бэлэг». */}
                    {i.is_sample && (
                      <Badge variant="secondary" className="ml-2">
                        Бэлэг
                      </Badge>
                    )}
                  </span>
                  <span className="font-medium">
                    {formatPrice(i.line_total)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Status history */}
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

          {openStatus && !beforeCutoff && (
            <p className="bg-secondary text-muted-foreground rounded-xl px-4 py-3 text-sm">
              Захиалга бэлтгэгдэж эхэлсэн тул ({formatEditCutoff(
                deliveryDayOf(order),
              )}{" "}
              өнгөрсөн) цуцлах, өөрчлөх боломжгүй. Асуудал гарвал пэйж чат
              эсвэл утсаар холбогдоно уу.
            </p>
          )}

          {reorderItems.length > 0 && (
            <OrderActions
              orderId={order.id}
              items={reorderItems}
              cancellable={cancellable}
            />
          )}
        </div>

        {/* Summary + shipping */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-5 text-sm">
              <h2 className="font-medium">Дүн</h2>
              {/* Дараалал нь мөнгө хөдөлсний дараалал: барааны дүн → хасагдах
                  нь → нэмэгдэх хүргэлт → төлсөн дүн. Захиалгын тойм,
                  төлбөрийн хуудас, и-мэйл гурав нь энэ дараалалтай нэг мөр. */}
              <Row label="Барааны дүн" value={formatPrice(order.subtotal)} />
              {order.discount > 0 && (
                <Row
                  label="Хөнгөлөлт"
                  value={`−${formatPrice(order.discount)}`}
                />
              )}
              {order.loyalty_used > 0 && (
                <Row
                  label="V point"
                  value={`−${formatPrice(order.loyalty_used)}`}
                />
              )}
              <Row
                label="Хүргэлт"
                value={
                  order.shipping_fee === 0
                    ? "Үнэгүй"
                    : `+${formatPrice(order.shipping_fee)}`
                }
              />
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
              {awaitingPayment && (
                <Button asChild size="lg" className="w-full">
                  <Link href={`/pay/${order.pay_token}`}>Төлбөр төлөх</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-5 text-sm">
              <h2 className="mb-2 font-medium">Хүргэлт</h2>
              <p className="mb-2">
                <span className="text-muted-foreground">Хүргэх өдөр: </span>
                <span className="font-medium">
                  {formatDeliveryDay(deliveryDayOf(order))}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {DISPATCH_HOUR}:00 цагт гарна
                </span>
              </p>
              <p>{order.contact_name}</p>
              <p className="text-muted-foreground">{order.contact_phone}</p>
              <p className="text-muted-foreground">
                {order.ship_city}
                {order.ship_district ? `, ${order.ship_district}` : ""},{" "}
                {order.ship_detail}
              </p>
              {order.note && (
                <p className="text-muted-foreground mt-2">
                  Тэмдэглэл: {order.note}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
