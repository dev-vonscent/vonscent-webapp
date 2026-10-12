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
  ArrowLeft,
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
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/db/types";
import { EmptyState } from "@/components/shared/empty-state";
import { SavedCheckouts } from "@/features/checkout/components/saved-checkouts";
import { reviewPointsOf } from "@/lib/loyalty";

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
};
type OrderWithItems = OrderRow & { order_items: OrderItemPreview[] };

/**
 * Хуудасны табууд (клиент, 2026-10): өмнө нь төлбөр хүлээж буй, явж буй,
 * хүргэгдсэн, цуцлагдсан захиалга, «Дараа захиалах» бүгд нэг жагсаалтад
 * холилдож, хэрэглэгч хэрэгтэйгээ хайж олоход хэцүү байв. Таб нь URL-д
 * (`?tab=`) — буцах товч, линк хуваалцах хоёулаа тухайн табаа хадгална.
 */
const TABS = [
  { key: "all", label: "Бүгд" },
  { key: "active", label: "Идэвхтэй" },
  { key: "saved", label: "Дараа захиалах" },
  { key: "delivered", label: "Хүргэгдсэн" },
  { key: "cancelled", label: "Цуцлагдсан" },
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

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // RLS нь staff-д бүх захиалгыг харуулдаг (`is_staff()`) — «Миний
    // захиалга» зөвхөн өөрийнхөө тул user_id-аар заавал шүүнэ.
    if (user) {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(product_id, product_name, brand, ml, qty)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      orders = (data as OrderWithItems[] | null) ?? [];
      const { data: loyalty } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "loyalty")
        .maybeSingle();
      reviewPoints = reviewPointsOf(
        (loyalty as { value?: unknown } | null)?.value,
      );
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
        <PageHeader />
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
  // огнооны дарааллаараа (sort тогтвортой).
  const shown = orders
    .filter((o) => tab === "all" || (tab !== "saved" && tabOf(o) === tab))
    .sort(
      (a, b) => Number(isAwaitingPayment(b)) - Number(isAwaitingPayment(a)),
    );

  return (
    <div className="space-y-6">
      <PageHeader count={orders.length + savedCount} />
      <OrderTabs tabs={tabs} current={tab} counts={counts} />

      {tab === "saved" ? (
        <SavedCheckouts emptyState={<TabEmpty tab="saved" />} />
      ) : shown.length === 0 ? (
        <TabEmpty tab={tab} />
      ) : (
        <div className="space-y-4">
          {shown.map((o) => (
            <OrderCard
              key={o.id}
              o={o}
              imageById={imageById}
              reviewPoints={reviewPoints}
            />
          ))}
        </div>
      )}
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

/**
 * Табын мөр — линкээр: шүүлт нь серверт, хуудас JS-гүйгээр ч ажиллана.
 *
 * Утсан дээр таван таб тоотойгоо нэг мөрөнд багтахгүй. Хэвтээ гүйлгэлт нь
 * сүүлчийн табуудыг «тасарсан» мэт нууж байсан тул тэнд мөр ороож буудаг
 * тусдаа чипүүд; `md`-ээс дээш газар хангалттай тул нэг segmented мөр
 * (`GenderSegmented`, collections-ийн хэлбэр).
 */
function OrderTabs({
  tabs,
  current,
  counts,
}: {
  tabs: readonly (typeof TABS)[number][];
  current: TabKey;
  counts: Record<TabKey, number>;
}) {
  return (
    <nav aria-label="Захиалгын ангилал">
      <div className="md:bg-secondary flex flex-wrap gap-2 md:inline-flex md:flex-nowrap md:gap-1 md:rounded-lg md:p-1">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              href={`/account/orders?tab=${t.key}`}
              replace
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors md:h-auto md:rounded-md md:px-3 md:py-1.5",
                active
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground md:bg-transparent",
              )}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    active ? "text-background/70" : "text-muted-foreground/80",
                  )}
                >
                  {counts[t.key]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
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
}: {
  o: OrderWithItems;
  imageById: Map<string, string | null>;
  reviewPoints: number;
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
function PageHeader({ count }: { count?: number }) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      <Link
        href="/account"
        aria-label="Буцах"
        className="bg-secondary text-foreground hover:bg-secondary/70 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="font-serif text-2xl font-semibold">Миний захиалга</h1>
      {count != null && count > 0 && (
        <span className="text-muted-foreground ml-auto text-sm">
          {count} захиалга
        </span>
      )}
    </div>
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
