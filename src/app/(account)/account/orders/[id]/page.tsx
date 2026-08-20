import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/features/products/api";
import { formatPrice, formatDate } from "@/lib/format";
import { isOrderEditable, formatDeadline } from "@/lib/time";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import {
  OrderActions,
  type ReorderItem,
} from "@/features/account/components/order-actions";
import type { OrderRow, OrderItemRow, OrderStatusHistoryRow } from "@/db/types";

/** Distinct chip colour per status (overrides the Badge variant via twMerge). */
const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  confirmed: "bg-sky-500/15 text-sky-500",
  shipping: "bg-violet-500/15 text-violet-400",
  delivered: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-red-500/20 text-red-400",
};

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

  // Cancellable only while the status allows it AND we're still before 10:00
  // on the dispatch day (requirement_fb.md §9).
  const openStatus = order.status === "pending" || order.status === "confirmed";
  const beforeCutoff = isOrderEditable(order.created_at);
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
            {formatDate(order.created_at)}
          </p>
        </div>
        <Badge className={STATUS_STYLE[order.status]}>
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
                    {i.is_sample && (
                      <Badge variant="secondary" className="ml-2">
                        Sample
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
                          {formatDate(h.created_at)}
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
              Захиалга бэлтгэгдэж эхэлсэн тул (
              {formatDeadline(order.created_at)} цагийн хугацаа өнгөрсөн)
              цуцлах, өөрчлөх боломжгүй. Асуудал гарвал пэйж чат эсвэл утсаар
              холбогдоно уу.
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
              <Row label="Дэд дүн" value={formatPrice(order.subtotal)} />
              {order.discount > 0 && (
                <Row
                  label="Хямдрал"
                  value={`−${formatPrice(order.discount)}`}
                />
              )}
              {order.loyalty_used > 0 && (
                <Row
                  label="V point"
                  value={`−${formatPrice(order.loyalty_used)}`}
                />
              )}
              <Row label="Хүргэлт" value={formatPrice(order.shipping_fee)} />
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Нийт</span>
                <span>{formatPrice(order.total)}</span>
              </div>
              <Badge
                variant={order.payment_status === "paid" ? "new" : "secondary"}
              >
                {order.payment_status === "paid"
                  ? "Төлсөн"
                  : order.payment_status === "refunded"
                    ? "Буцаагдсан"
                    : "Төлөөгүй"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-5 text-sm">
              <h2 className="mb-2 font-medium">Хүргэлт</h2>
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
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
