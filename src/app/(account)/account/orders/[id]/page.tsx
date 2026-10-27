import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark } from "lucide-react";
import { AccountBackButton } from "@/features/account/components/account-page-header";
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
  DELIVERY_END_HOUR,
  DISPATCH_HOUR,
  deliveryDayOf,
  formatDeliveryDay,
  isOrderEditable,
} from "@/lib/time";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_WINDOW_MINUTES,
} from "@/lib/constants";
import {
  OrderActions,
  type ReorderItem,
} from "@/features/account/components/order-actions";
import { maskAccount, refundBreakdown } from "@/lib/refund";
import { settleExpiredOrders } from "@/features/account/settle-expired";
import { EmptyState } from "@/components/shared/empty-state";
import { reviewPointsOf } from "@/lib/loyalty";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { ReviewRejectReason, ReviewStatus } from "@/lib/constants";
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

  // Хугацаа нь дууссан бол cron-ыг хүлээлгүй одоо шилжүүлнэ — жагсаалттай
  // ижил төлөв харагдана (settle-expired.ts).
  await settleExpiredOrders(user.id);

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
  // Төлөгдөөгүй цуцлалт захиалга болж үлдэхгүй (0124, клиент 2026-10).
  // «Дараа захиалах» руу шилжсэн бол хуучин линкээр ирсэн хүнд «Цуцлагдсан»
  // биш, хаана очсоныг нь хэлнэ; устгасан бол юу ч үлдээгүй — 404.
  if (order.status === "cancelled" && order.payment_status === "unpaid") {
    const { count } = await supabase
      .from("saved_checkouts")
      .select("id", { count: "exact", head: true })
      .eq("source_order_id", order.id);
    if (!count) notFound();
    return <MovedToSaved orderNo={order.order_no} />;
  }

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

  // Resolve slugs/images for the reorder action. Дахин захиалах нь зөвхөн
  // амжилттай хүргэгдсэн захиалгад, бэлгийн мөргүйгээр — бэлэг сар бүр
  // өөрчлөгддөг тул дахин захиалахад тэр сарынх нь бэлэг ирэхгүй.
  const productIds = [
    ...new Set(items.map((i) => i.product_id).filter(Boolean)),
  ] as string[];
  const products = await getProductsByIds(productIds);
  const byId = new Map(products.map((p) => [p.id, p]));

  const reorderItems: ReorderItem[] = items
    .filter(
      (i) =>
        order.status === "delivered" &&
        i.product_id &&
        i.variant_id &&
        !i.is_gift &&
        !i.is_sample,
    )
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
    // Туг `review_moderation` (0162): base багцаар авсан ус багц доторх ус тус
    // бүрт биш, багцад нэг сэтгэгдэл; тусад нь авсан ус бол усанд.
    const moderated = await isFeatureEnabled("review_moderation");
    const bought = items.filter(
      (i) => i.product_id && !i.is_gift && !i.is_sample,
    );
    const purchased = [
      ...new Set(
        bought
          .filter((i) => !moderated || !i.collection_id)
          .map((i) => i.product_id as string),
      ),
    ].filter((pid) => byId.get(pid)?.slug);
    const bundleIds = moderated
      ? [
          ...new Set(
            bought.map((i) => i.collection_id).filter(Boolean) as string[],
          ),
        ]
      : [];

    if (purchased.length > 0 || bundleIds.length > 0) {
      const none = Promise.resolve({ data: null });
      const [
        { data: reviewData },
        { data: loyaltyData },
        { data: rewardData },
        { data: bundleData },
        { data: bundleRewardData },
      ] = await Promise.all([
        supabase
          .from("reviews")
          .select(
            "product_id, collection_id, status, reject_reason, reject_note",
          )
          .eq("user_id", user.id)
          .or(
            [
              purchased.length && `product_id.in.(${purchased.join(",")})`,
              bundleIds.length && `collection_id.in.(${bundleIds.join(",")})`,
            ]
              .filter(Boolean)
              .join(","),
          ),
        supabase
          .from("settings")
          .select("value")
          .eq("key", "loyalty")
          .maybeSingle(),
        moderated && purchased.length
          ? supabase
              .from("review_rewards")
              .select("product_id, points")
              .eq("user_id", user.id)
              .in("product_id", purchased)
          : none,
        bundleIds.length
          ? supabase
              .from("collections")
              .select("id, slug, name, image_url")
              .eq("type", "base")
              .in("id", bundleIds)
          : none,
        bundleIds.length
          ? supabase
              .from("collection_review_rewards")
              .select("collection_id, points")
              .eq("user_id", user.id)
              .in("collection_id", bundleIds)
          : none,
      ]);

      type ReviewRef = {
        product_id: string | null;
        collection_id: string | null;
        status: ReviewStatus;
        reject_reason: ReviewRejectReason | null;
        reject_note: string | null;
      };
      const reviewed = new Map(
        ((reviewData as ReviewRef[] | null) ?? []).map((r) => [
          r.product_id ? `p:${r.product_id}` : `c:${r.collection_id}`,
          r,
        ]),
      );
      const rewarded = new Map<string, number>([
        ...(
          (rewardData as { product_id: string; points: number }[] | null) ?? []
        ).map((r) => [`p:${r.product_id}`, r.points] as const),
        ...(
          (bundleRewardData as
            | { collection_id: string; points: number }[]
            | null) ?? []
        ).map((r) => [`c:${r.collection_id}`, r.points] as const),
      ]);
      reviewPoints = reviewPointsOf(
        (loyaltyData as { value?: unknown } | null)?.value,
      );

      const withStatus = (
        key: string,
        item: Pick<ReviewableItem, "href" | "title" | "image">,
      ): ReviewableItem => {
        const review = reviewed.get(key);
        return {
          key,
          ...item,
          reviewed: Boolean(review),
          moderation:
            moderated && review
              ? {
                  status: review.status,
                  rejectReason: review.reject_reason,
                  rejectNote: review.reject_note,
                  rewardPoints: rewarded.get(key) ?? 0,
                }
              : undefined,
        };
      };

      reviewItems = [
        ...purchased.map((pid) => {
          const p = byId.get(pid)!;
          const line = items.find((i) => i.product_id === pid)!;
          return withStatus(`p:${pid}`, {
            href: `/products/${p.slug}`,
            title: `${line.brand} ${line.product_name}`,
            image: p.image?.url ?? null,
          });
        }),
        // Идэвхгүй/устсан багц уншигдахгүй — сэтгэгдлийн хуудасгүй тул алгасна.
        ...(
          (bundleData as
            | {
                id: string;
                slug: string;
                name: string;
                image_url: string | null;
              }[]
            | null) ?? []
        ).map((c) =>
          withStatus(`c:${c.id}`, {
            href: `/collections/${c.slug}`,
            title: `${c.name} (багц)`,
            image: c.image_url,
          }),
        ),
      ];
    }
  }

  // Төлсөн захиалгыг хэрэглэгч цуцлахгүй (клиент, 2026-10-26) — зөвхөн
  // төлөөгүй, хүргэх өдөр нь эхлээгүй захиалга.
  const cancellable =
    order.payment_status !== "paid" &&
    (order.status === "pending" || order.status === "confirmed") &&
    isOrderEditable(order);

  return (
    <div className="space-y-6">
      {/* Утсан дээр сайтын толгой «← Миний захиалга»-г харуулдаг тул ← товч
          md-ээс дээш л; дугаар, огноо нь хоёуланд нь хэрэгтэй. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AccountBackButton
            href="/account/orders"
            className="hidden md:flex"
          />
          <div>
            <h1 className="font-serif text-2xl font-semibold">
              {order.order_no}
            </h1>
            <p className="text-muted-foreground text-sm">
              {formatDateTime(order.created_at)}
            </p>
          </div>
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

          {(reorderItems.length > 0 || awaitingPayment || cancellable) && (
            <OrderActions
              orderId={order.id}
              items={reorderItems}
              cancellable={cancellable}
              payToken={awaitingPayment ? order.pay_token : null}
              canSaveForLater={order.checkout_snapshot !== null}
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
                  · {DISPATCH_HOUR}:00–{DELIVERY_END_HOUR}:00 цагийн хооронд
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

/**
 * Төлөгдөөгүй тул «Дараа захиалах» руу шилжсэн захиалга (0124). Жагсаалтад
 * харагдахгүй ч имэйл, хуучин линкээр ирж болно.
 */
function MovedToSaved({ orderNo }: { orderNo: string }) {
  return (
    <div className="space-y-6">
      <AccountBackButton href="/account/orders" className="hidden md:flex" />
      <EmptyState
        size="lg"
        icon={Bookmark}
        title={`${orderNo} — «Дараа захиалах» руу шилжсэн`}
        description={`Төлбөр ${PAYMENT_WINDOW_MINUTES} минутын дотор төлөгдөөгүй тул захиалгыг «Дараа захиалах» хэсэгт хадгаллаа. Тэндээс хүссэн үедээ дахин захиалаарай.`}
        action={
          <Button asChild>
            <Link href="/account/orders?tab=saved">
              Дараа захиалах руу очих
            </Link>
          </Button>
        }
      />
    </div>
  );
}
