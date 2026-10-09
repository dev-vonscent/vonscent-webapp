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
import { cn } from "@/lib/utils";
import {
  orderSummaryRows,
  summarySource,
  type OrderSummaryRow,
} from "@/lib/orders/summary";
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
import { maskAccount, refundBreakdown } from "@/lib/refund";
import { reviewPointsOf } from "@/lib/loyalty";
import {
  OrderReviewPrompt,
  type ReviewableItem,
} from "@/features/reviews/components/order-review-prompt";
import type {
  OrderRow,
  OrderItemRow,
  OrderRefundAccountRow,
  OrderStatusHistoryRow,
} from "@/db/types";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // RLS staff-д бусдын захиалгыг ч нээдэг — энэ хуудас зөвхөн эзэндээ
  // (staff бол админ самбараас харна).
  const { data: orderData } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const order = orderData as OrderRow | null;
  if (!order) notFound();

  // Мөнгө хүлээж буй захиалга — энэ хуудасны үндсэн үйлдэл нь төлөх болно.
  const awaitingPayment =
    order.payment_status === "unpaid" &&
    order.status !== "cancelled" &&
    Boolean(order.pay_token);

  // Цуцлагдсан, төлсөн (буцаагдаагүй) захиалга — мөнгө замдаа явж байна.
  const refundPending =
    order.status === "cancelled" && order.payment_status === "paid";

  const [{ data: itemData }, { data: historyData }, { data: refundData }] =
    await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", id),
      supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: true }),
      refundPending
        ? supabase
            .from("order_refund_accounts")
            .select("*")
            .eq("order_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const refundAccount = refundData as OrderRefundAccountRow | null;
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

  // Сэтгэгдлийн урилга (0117): төлөгдсөн, цуцлагдаагүй захиалгад. Бэлгийн
  // мөр худалдаж авсан бараа биш тул урамшуулалд ч, жагсаалтад ч орохгүй.
  const reviewPromptOpen =
    order.payment_status === "paid" &&
    (order.status === "confirmed" ||
      order.status === "shipping" ||
      order.status === "delivered");
  let reviewItems: ReviewableItem[] = [];
  let reviewPoints = 0;
  if (reviewPromptOpen) {
    const purchased = [
      ...new Set(
        items
          .filter((i) => i.product_id && !i.is_gift && !i.is_sample)
          .map((i) => i.product_id as string),
      ),
    ].filter((pid) => byId.get(pid)?.slug);
    if (purchased.length > 0) {
      const [{ data: reviewData }, { data: loyaltyData }] = await Promise.all([
        supabase
          .from("reviews")
          .select("product_id")
          .eq("user_id", user.id)
          .in("product_id", purchased),
        supabase
          .from("settings")
          .select("value")
          .eq("key", "loyalty")
          .maybeSingle(),
      ]);
      const reviewed = new Set(
        ((reviewData as { product_id: string }[] | null) ?? []).map(
          (r) => r.product_id,
        ),
      );
      reviewPoints = reviewPointsOf(
        (loyaltyData as { value?: unknown } | null)?.value,
      );
      reviewItems = purchased.map((pid) => {
        const p = byId.get(pid)!;
        const line = items.find((i) => i.product_id === pid)!;
        return {
          productId: pid,
          slug: p.slug,
          name: line.product_name,
          brand: line.brand,
          image: p.image?.url ?? null,
          reviewed: reviewed.has(pid),
        };
      });
    }
  }

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
                    {formatPrice((i.list_price ?? i.unit_price) * i.qty)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {reviewPromptOpen && (
            <OrderReviewPrompt
              delivered={order.status === "delivered"}
              reviewPoints={reviewPoints}
              items={reviewItems}
            />
          )}

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
              Захиалга бэлтгэгдэж эхэлсэн тул (
              {formatEditCutoff(deliveryDayOf(order))} өнгөрсөн) цуцлах, өөрчлөх
              боломжгүй. Асуудал гарвал пэйж чат эсвэл утсаар холбогдоно уу.
            </p>
          )}

          {reorderItems.length > 0 && (
            <OrderActions
              orderId={order.id}
              items={reorderItems}
              cancellable={cancellable}
              paid={order.payment_status === "paid"}
              total={order.total}
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
              {refundPending && (
                // Цуцалсны дараа «мөнгө минь хаана байна» гэдгийг энд хэлнэ —
                // дүн нь нийт − 1% шимтгэл (src/lib/refund.ts).
                <div className="bg-secondary space-y-1 rounded-lg p-3">
                  <p className="font-medium">
                    Буцаалт хүлээгдэж байна ·{" "}
                    <span className="tabular-nums">
                      {formatPrice(refundBreakdown(order.total).amount)}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {refundAccount
                      ? `${refundAccount.bank} · ${maskAccount(refundAccount.account_number)} данс руу шилжүүлнэ.`
                      : "Бид тантай холбогдож буцаалтын дансыг тань тодруулна."}
                  </p>
                </div>
              )}
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
