import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  ChevronRight,
  MessageSquarePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/features/products/api";
import { formatPrice, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  type OrderStatus,
  type ReviewStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/db/types";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountPageHeader } from "@/features/account/components/account-page-header";
import { OrderTabs } from "@/features/account/components/order-tabs";
import { SavedCheckouts } from "@/features/checkout/components/saved-checkouts";
import { reviewPointsOf } from "@/lib/loyalty";
import { settleExpiredOrders } from "@/features/account/settle-expired";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { lifetimeSpendOf, tierProgress } from "@/features/tiers/lib";
import { TierBadge } from "@/features/tiers/components/tier-frame";

const STATUS_ICON: Record<
  OrderStatus,
  React.ComponentType<{ className?: string }>
> = {
  pending: Clock,
  confirmed: CheckCircle2,
  shipping: Truck,
  delivered: PackageCheck,
  cancelled: XCircle,
};

/** Linear fulfilment flow used for the per-order progress stepper. */
const FLOW: {
  status: OrderStatus;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { status: "pending", icon: Clock },
  { status: "confirmed", icon: CheckCircle2 },
  { status: "shipping", icon: Truck },
  { status: "delivered", icon: PackageCheck },
];

type OrderItemPreview = {
  product_id: string | null;
  product_name: string;
  brand: string;
  ml: number;
  qty: number;
  is_gift: boolean | null;
  is_sample: boolean | null;
  collection_id: string | null;
};

/**
 * Хүргэгдсэн захиалгын сэтгэгдлийн төлөв (туг `review_moderation`, 0162):
 * сэтгэгдлийн нэгж бүрт (тусад нь авсан ус `p:<id>`, base багц `c:<id>`)
 * бичсэн бол шалгагдаж буй / батлагдсан / цуцлагдсан.
 */
type OrderReviewState =
  | { kind: "invite" }
  | { kind: "pending" }
  | { kind: "approved"; points: number }
  | { kind: "rejected" };

function orderReviewState(
  o: OrderWithItems,
  statusByKey: Map<string, ReviewStatus>,
  rewardByKey: Map<string, number>,
): OrderReviewState | null {
  const bought = [
    ...new Set(
      (o.order_items ?? [])
        .filter((i) => i.product_id && !i.is_gift && !i.is_sample)
        .map((i) =>
          i.collection_id ? `c:${i.collection_id}` : `p:${i.product_id}`,
        ),
    ),
  ];
  if (bought.length === 0) return null;
  const statuses = bought.map((key) => statusByKey.get(key));
  if (statuses.some((st) => st === undefined)) return { kind: "invite" };
  if (statuses.includes("pending")) return { kind: "pending" };
  if (statuses.every((st) => st === "approved")) {
    return {
      kind: "approved",
      points: bought.reduce((n, key) => n + (rewardByKey.get(key) ?? 0), 0),
    };
  }
  return { kind: "rejected" };
}
type OrderWithItems = OrderRow & { order_items: OrderItemPreview[] };

/**
 * Хуудасны табууд (клиент, 2026-10): өмнө нь төлбөр хүлээж буй, явж буй,
 * хүргэгдсэн, цуцлагдсан захиалга, «Дараа захиалах» бүгд нэг жагсаалтад
 * холилдож, хэрэглэгч хэрэгтэйгээ хайж олоход хэцүү байв. Таб нь URL-д
 * (`?tab=`) — буцах товч, линк хуваалцах хоёулаа тухайн табаа хадгална.
 */
// `short` — утсан дээр таван таб тэнцүү өргөнтэй нэг мөрөнд багтахын тулд.
const TABS = [
  { key: "all", label: "Бүгд", short: "Бүгд" },
  { key: "active", label: "Идэвхтэй", short: "Идэвхтэй" },
  { key: "saved", label: "Дараа захиалах", short: "Дараа" },
  { key: "delivered", label: "Хүргэгдсэн", short: "Хүргэсэн" },
  { key: "cancelled", label: "Цуцлагдсан", short: "Цуцалсан" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function tabOf(o: OrderRow): Exclude<TabKey, "all" | "saved"> {
  if (o.status === "delivered") return "delivered";
  if (o.status === "cancelled") return "cancelled";
  return "active";
}

const TAB_EMPTY: Record<TabKey, { title: string; description: string }> = {
  all: {
    title: "Захиалга алга байна",
    description: "Эхний захиалгаа өгөөд энд хянаарай.",
  },
  active: {
    title: "Идэвхтэй захиалга алга",
    description:
      "Төлбөр хүлээж буй болон хүргэлтэд гарах захиалга энд харагдана.",
  },
  saved: {
    title: "Хадгалсан захиалга алга",
    description:
      "Checkout дээр «Дараа захиалах» дарсан захиалга энд хадгалагдана.",
  },
  delivered: {
    title: "Хүргэгдсэн захиалга алга",
    description: "Хүргэгдсэн захиалгаа эндээс дахин захиалах боломжтой.",
  },
  cancelled: {
    title: "Цуцлагдсан захиалга алга",
    description: "",
  },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const supabase = await createClient();
  let orders: OrderWithItems[] = [];
  let reviewPoints = 0;
  let savedCount = 0;
  // Туг `review_moderation` (0162) нээлттэй үед л дүүрнэ.
  let reviewStatuses: Map<string, ReviewStatus> | null = null;
  let reviewRewards = new Map<string, number>();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // RLS нь staff-д бүх захиалгыг харуулдаг (`is_staff()`) — «Миний
    // захиалга» зөвхөн өөрийнхөө тул user_id-аар заавал шүүнэ.
    if (user) {
      // Хугацаа нь дууссан захиалгыг cron-ыг хүлээлгүй «Дараа захиалах» руу —
      // эс бөгөөс 5 хүртэл минут «Хүлээгдэж буй» гэж харагдсаар байна.
      await settleExpiredOrders(user.id);
      const { data } = await supabase
        .from("orders")
        .select(
          "*, order_items(product_id, product_name, brand, ml, qty, is_gift, is_sample, collection_id)",
        )
        .eq("user_id", user.id)
        // Төлөгдөөгүй цуцлалт захиалга биш (0124) — устгасан нь хаана ч
        // үлдэхгүй, «Дараа захиалах» руу шилжсэн нь тэндээ харагдана.
        .or("status.neq.cancelled,payment_status.neq.unpaid")
        .order("created_at", { ascending: false });
      orders = (data as OrderWithItems[] | null) ?? [];
      const [{ data: loyalty }, { count }] = await Promise.all([
        supabase
          .from("settings")
          .select("value")
          .eq("key", "loyalty")
          .maybeSingle(),
        supabase
          .from("saved_checkouts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      savedCount = count ?? 0;
      reviewPoints = reviewPointsOf(
        (loyalty as { value?: unknown } | null)?.value,
      );

      if (await isFeatureEnabled("review_moderation")) {
        const [
          { data: reviewRows },
          { data: rewardRows },
          { data: bundleRewardRows },
        ] = await Promise.all([
          supabase
            .from("reviews")
            .select("product_id, collection_id, status")
            .eq("user_id", user.id),
          supabase
            .from("review_rewards")
            .select("product_id, points")
            .eq("user_id", user.id),
          supabase
            .from("collection_review_rewards")
            .select("collection_id, points")
            .eq("user_id", user.id),
        ]);
        reviewStatuses = new Map(
          (
            (reviewRows as
              | {
                  product_id: string | null;
                  collection_id: string | null;
                  status: ReviewStatus;
                }[]
              | null) ?? []
          ).map((r) => [
            r.product_id ? `p:${r.product_id}` : `c:${r.collection_id}`,
            r.status,
          ]),
        );
        reviewRewards = new Map([
          ...(
            (rewardRows as { product_id: string; points: number }[] | null) ??
            []
          ).map((r) => [`p:${r.product_id}`, r.points] as const),
          ...(
            (bundleRewardRows as
              | { collection_id: string; points: number }[]
              | null) ?? []
          ).map((r) => [`c:${r.collection_id}`, r.points] as const),
        ]);
      }
    }
  }

  // Resolve product thumbnails for every line item across all orders.
  const productIds = [
    ...new Set(
      orders
        .flatMap((o) => o.order_items ?? [])
        .map((i) => i.product_id)
        .filter(Boolean) as string[],
    ),
  ];
  const products = await getProductsByIds(productIds);
  const imageById = new Map(
    products.map((p) => [p.id, p.image?.url ?? null] as const),
  );

  if (orders.length === 0 && savedCount === 0) {
    return (
      <div className="space-y-6">
        <AccountPageHeader title="Миний захиалга" />
        <EmptyState
          size="lg"
          icon={Package}
          title="Захиалга алга байна"
          description="Эхний захиалгаа өгөөд энд хянаарай."
          action={
            <Button asChild>
              <Link href="/catalog">Бараа үзэх</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // «Бүгд» нь бүх захиалга — «Дараа захиалах» нь захиалга биш (хадгалсан
  // сагс) тул тусдаа табдаа л үлдэнэ, эс бөгөөс холилдох асуудал буцаж ирнэ.
  const counts: Record<TabKey, number> = {
    all: orders.length,
    active: 0,
    saved: savedCount,
    delivered: 0,
    cancelled: 0,
  };
  for (const o of orders) counts[tabOf(o)] += 1;

  // «Цуцлагдсан» нь ховор — хоосон бол табыг ч харуулахгүй.
  const tabs = TABS.filter(
    (t) => t.key !== "cancelled" || counts.cancelled > 0,
  );
  // Анх «Идэвхтэй» нээгдэнэ (клиент, 2026-10) — хэрэглэгч ихэвчлэн явж
  // буй захиалгаа хардаг. Хоосон бол «Бүгд», захиалга огт байхгүй бол
  // «Дараа захиалах» — хоосон таб дээр буухгүй.
  const tab: TabKey =
    tabs.find((t) => t.key === tabParam)?.key ??
    (counts.active > 0 ? "active" : orders.length > 0 ? "all" : "saved");

  // Төлбөр хүлээж буй нь эхэнд — хугацаатай, үйлдэл шаарддаг. Бусад нь
  // огнооны дарааллаараа (sort тогтвортой). Таб бүр энэ дарааллыг шүүж л авна.
  const sorted = [...orders].sort(
    (a, b) => Number(isAwaitingPayment(b)) - Number(isAwaitingPayment(a)),
  );

  // Нийт захиалгын дүн ба түвшин (feature flag `user_tiers`, 0143).
  const tiersOn = await isFeatureEnabled("user_tiers");

  return (
    <div className="space-y-6">
      {/* Тоо нь утсан дээр нуугдана — толгой бүхэлдээ нуугдахгүй бол хоосон
          мөр `space-y`-ийн зай авч, бусад дэд хуудаснаас доогуур эхэлнэ. */}
      <AccountPageHeader
        title="Миний захиалга"
        className="hidden md:flex"
        aside={
          <span className="text-muted-foreground hidden text-sm md:inline">
            {orders.length + savedCount} захиалга
          </span>
        }
      />
      {tiersOn && <SpendSummary spend={lifetimeSpendOf(orders)} />}
      <OrderTabs
        tabs={tabs.map((t) => ({
          value: t.key,
          label: t.label,
          short: t.short,
          count: counts[t.key],
        }))}
        initialTab={tab}
        orders={sorted.map((o) => ({
          id: o.id,
          tab: tabOf(o),
          card: (
            <OrderCard
              o={o}
              imageById={imageById}
              reviewPoints={reviewPoints}
              reviewState={
                reviewStatuses && o.status === "delivered"
                  ? orderReviewState(o, reviewStatuses, reviewRewards)
                  : undefined
              }
            />
          ),
        }))}
        saved={<SavedCheckouts emptyState={<TabEmpty tab="saved" />} />}
        empty={{
          all: <TabEmpty tab="all" />,
          active: <TabEmpty tab="active" />,
          saved: <TabEmpty tab="saved" />,
          delivered: <TabEmpty tab="delivered" />,
          cancelled: <TabEmpty tab="cancelled" />,
        }}
      />
    </div>
  );
}

/** Мөнгө хүлээж буй, төлөх замтай захиалга. */
function isAwaitingPayment(o: OrderRow): boolean {
  return (
    o.payment_status === "unpaid" &&
    o.status !== "cancelled" &&
    Boolean(o.pay_token)
  );
}

function TabEmpty({ tab }: { tab: TabKey }) {
  const { title, description } = TAB_EMPTY[tab];
  return (
    <EmptyState
      icon={Package}
      title={title}
      description={description || undefined}
      action={
        tab === "cancelled" ? undefined : (
          <Button asChild variant="outline">
            <Link href="/catalog">Бараа үзэх</Link>
          </Button>
        )
      }
    />
  );
}

function OrderCard({
  o,
  imageById,
  reviewPoints,
  reviewState,
}: {
  o: OrderWithItems;
  imageById: Map<string, string | null>;
  reviewPoints: number;
  /** null — сэтгэгдэл бичих бараагүй; undefined — хуучин урилга (туг хаалттай). */
  reviewState?: OrderReviewState | null;
}) {
  const StatusIcon = STATUS_ICON[o.status];
  const items = o.order_items ?? [];
  const itemCount = items.reduce((n, i) => n + (i.qty ?? 0), 0);
  const thumbs = items.slice(0, 4);
  const extraCount = items.length - thumbs.length;
  const firstName = items[0]
    ? `${items[0].brand} ${items[0].product_name}`
    : "";
  const firstMl = items[0]?.ml;
  // `pay_token` байхгүй (демо/хуучин мөр) бол төлөх зам ч байхгүй.
  const awaitingPayment = isAwaitingPayment(o);
  // Сэтгэгдлийн урилга (0117) — төлөгдсөн, явж буй/хүргэгдсэн захиалгад.
  const reviewInvite =
    (reviewState === undefined || reviewState?.kind === "invite") &&
    reviewPoints > 0 &&
    o.payment_status === "paid" &&
    (o.status === "confirmed" ||
      o.status === "shipping" ||
      o.status === "delivered");

  return (
    <Card
      key={o.id}
      className="group hover:border-gold-strong hover:shadow-lift overflow-hidden transition-all"
    >
      <Link href={`/account/orders/${o.id}`} className="block">
        <CardContent className="p-5 pb-0">
          {/* Header: order no + date · status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono font-medium">{o.order_no}</p>
              <p className="text-muted-foreground text-sm">
                {formatDateTime(o.created_at)}
                {itemCount > 0 && ` · ${itemCount} ширхэг`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge className={cn("gap-1", ORDER_STATUS_STYLE[o.status])}>
                <StatusIcon className="size-3.5" />
                {ORDER_STATUS_LABEL[o.status]}
              </Badge>
              {/* Төлбөрийн төлөв: «төлсөн pending» ба «төлөөгүй
                    pending» хоёр өмнө нь ялгагдахгүй байв. */}
              {o.payment_status !== "paid" && o.status !== "cancelled" && (
                <Badge
                  className={cn(
                    "gap-1",
                    o.payment_status === "refunded"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/15 text-amber-500",
                  )}
                >
                  {PAYMENT_STATUS_LABEL[o.payment_status]}
                </Badge>
              )}
            </div>
          </div>

          {/* Item thumbnails */}
          {thumbs.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              {thumbs.map((i, idx) => {
                const url = i.product_id ? imageById.get(i.product_id) : null;
                return (
                  <div
                    key={idx}
                    className="border-border bg-secondary relative size-14 shrink-0 overflow-hidden rounded-xl border"
                  >
                    {url ? (
                      <Image
                        src={url}
                        alt={i.product_name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <Package className="text-muted-foreground size-5" />
                      </span>
                    )}
                  </div>
                );
              })}
              {extraCount > 0 && (
                <div className="border-border bg-secondary text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-xl border border-dashed text-sm font-medium">
                  +{extraCount}
                </div>
              )}
              {firstName && (
                <div className="ml-1 min-w-0">
                  <p className="text-muted-foreground truncate text-sm">
                    {firstName}
                    {items.length > 1 && ` ба бусад ${items.length - 1}`}
                  </p>
                  {firstMl != null && (
                    <p className="text-muted-foreground text-xs">{firstMl}ml</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress stepper (hidden for cancelled orders) */}
          {o.status !== "cancelled" && (
            <Stepper status={o.status} paid={o.payment_status !== "unpaid"} />
          )}
        </CardContent>
      </Link>

      {/* Доод мөр нь картын линкээс ГАДУУР: төлбөрийн товч нь өөрөө
            линк тул үүрлэсэн <a> үүсгэхгүйн тулд. */}
      <div className="px-5 pb-5">
        <Separator className="my-3" />

        {reviewState && reviewState.kind !== "invite" && (
          <ReviewStateNote orderId={o.id} state={reviewState} />
        )}

        {reviewInvite && (
          <Link
            href={`/account/orders/${o.id}`}
            className="bg-secondary text-muted-foreground hover:text-foreground mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
          >
            <MessageSquarePlus className="size-4 shrink-0" />
            <span>
              {o.status === "delivered"
                ? "Бараагаа хэрэглэж үзээд сэтгэгдлээ бичээд "
                : "Бараагаа хүлээж аваад, хэрэглэж үзээд сэтгэгдлээ бичээд "}
              <strong className="text-foreground font-medium tabular-nums">
                +{reviewPoints.toLocaleString("mn-MN")} V point
              </strong>{" "}
              цуглуулаарай.
            </span>
          </Link>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs">Нийт дүн</p>
            <p className="text-lg font-semibold">{formatPrice(o.total)}</p>
          </div>
          {awaitingPayment ? (
            <Button asChild size="lg" className="shrink-0">
              <Link href={`/pay/${o.pay_token}`}>Төлбөр төлөх</Link>
            </Button>
          ) : (
            <Link
              href={`/account/orders/${o.id}`}
              className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
            >
              Дэлгэрэнгүй
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Page heading — desktop only. On mobile the compact site header already shows
 * the "Миний захиалга" title and a back button, so we hide this to avoid a
 * duplicate title.
 */
/** Нийт захиалгын дүн + түвшин рүү орох зам (feature flag `user_tiers`). */
function SpendSummary({ spend }: { spend: number }) {
  const { tier, next, remaining, ratio } = tierProgress(spend);
  return (
    <Link
      href="/account/tier"
      className="bg-card hover:bg-accent group block space-y-3 rounded-2xl p-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">Нийт захиалгын дүн</p>
          <p className="font-serif text-2xl font-semibold tabular-nums">
            {formatPrice(spend)}
          </p>
        </div>
        <TierBadge tier={tier.key} className="ml-auto" />
        <ChevronRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
      </div>
      {next && (
        <div className="space-y-1.5">
          <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {next.label} түвшин хүртэл {formatPrice(remaining)} дутуу
          </p>
        </div>
      )}
    </Link>
  );
}

/**
 * Compact 4-step fulfilment progress bar.
 *
 * `paid` -г тусад нь авдаг шалтгаан: захиалга `pending` төлөвт мөнгө хүлээж
 * байхад эхний алхмыг дүүргэвэл ахиц гарсан мэт харагдаж, төлбөр хүлээгдэж
 * буйг нуудаг. Төлбөр батлагдаагүй бол нэг ч алхам дүүрэхгүй.
 */
function Stepper({ status, paid }: { status: OrderStatus; paid: boolean }) {
  const current = paid ? FLOW.findIndex((s) => s.status === status) : -1;
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {FLOW.map((step, i) => {
        const done = i <= current;
        const Icon = step.icon;
        return (
          <div key={step.status} className="flex flex-1 items-center gap-1.5">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground",
              )}
              title={ORDER_STATUS_LABEL[step.status]}
            >
              <Icon className="size-3.5" />
            </div>
            {i < FLOW.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i < current ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Хүргэгдсэн захиалгын сэтгэгдлийн төлөв — дэлгэрэнгүй рүү үсэрнэ. */
function ReviewStateNote({
  orderId,
  state,
}: {
  orderId: string;
  state: Exclude<OrderReviewState, { kind: "invite" }>;
}) {
  return (
    <Link
      href={`/account/orders/${orderId}`}
      className="bg-secondary text-muted-foreground hover:text-foreground mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
    >
      {state.kind === "approved" ? (
        <>
          <CheckCircle2 className="text-success size-4 shrink-0" />
          <span>
            Сэтгэгдэл баталгаажсан. Баярлалаа!
            {state.points > 0 && (
              <>
                {" "}
                <strong className="text-foreground font-medium tabular-nums">
                  +{state.points.toLocaleString("mn-MN")} V point
                </strong>{" "}
                цуглуулсан.
              </>
            )}
          </span>
        </>
      ) : state.kind === "pending" ? (
        <>
          <Clock className="size-4 shrink-0" />
          <span>
            Сэтгэгдэл шалгагдаж байна. Батлагдсаны дараа 24 цагийн дотор V point
            нэмэгдэнэ.
          </span>
        </>
      ) : (
        <>
          <XCircle className="text-destructive size-4 shrink-0" />
          <span>
            Сэтгэгдэл цуцлагдсан — шалтгааныг дэлгэрэнгүйгээс харна уу.
          </span>
        </>
      )}
    </Link>
  );
}
