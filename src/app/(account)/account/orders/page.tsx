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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { getProductsByIds } from "@/features/products/api";
import { formatPrice, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/db/types";

/** Distinct chip colour per status (overrides the Badge variant via twMerge). */
const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  confirmed: "bg-sky-500/15 text-sky-500",
  shipping: "bg-violet-500/15 text-violet-400",
  delivered: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-red-500/20 text-red-400",
};

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

export default async function OrdersPage() {
  const supabase = await createClient();
  let orders: OrderWithItems[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(product_id, product_name, brand, ml, qty)")
      .order("created_at", { ascending: false });
    orders = (data as OrderWithItems[] | null) ?? [];
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

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="border-border flex flex-col items-center gap-4 rounded-2xl border border-dashed py-20 text-center">
          <div className="bg-secondary flex size-16 items-center justify-center rounded-full">
            <Package className="text-muted-foreground size-7" />
          </div>
          <div>
            <p className="font-medium">Захиалга алга байна</p>
            <p className="text-muted-foreground text-sm">
              Эхний захиалгаа өгөөд энд хянаарай.
            </p>
          </div>
          <Button asChild>
            <Link href="/catalog">Бараа үзэх</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader count={orders.length} />

      <div className="space-y-4">
        {orders.map((o) => {
          const StatusIcon = STATUS_ICON[o.status];
          const items = o.order_items ?? [];
          const itemCount = items.reduce((n, i) => n + (i.qty ?? 0), 0);
          const thumbs = items.slice(0, 4);
          const extraCount = items.length - thumbs.length;
          const firstName = items[0]
            ? `${items[0].brand} ${items[0].product_name}`
            : "";
          const firstMl = items[0]?.ml;

          return (
            <Card
              key={o.id}
              className="group hover:border-primary hover:shadow-lift overflow-hidden transition-all"
            >
              <Link href={`/account/orders/${o.id}`} className="block">
                <CardContent className="p-5">
                  {/* Header: order no + date · status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-medium">{o.order_no}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatDate(o.created_at)}
                        {itemCount > 0 && ` · ${itemCount} ширхэг`}
                      </p>
                    </div>
                    <Badge
                      className={cn("shrink-0 gap-1", STATUS_STYLE[o.status])}
                    >
                      <StatusIcon className="size-3.5" />
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </div>

                  {/* Item thumbnails */}
                  {thumbs.length > 0 && (
                    <div className="mt-4 flex items-center gap-2">
                      {thumbs.map((i, idx) => {
                        const url = i.product_id
                          ? imageById.get(i.product_id)
                          : null;
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
                            {items.length > 1 &&
                              ` ба бусад ${items.length - 1}`}
                          </p>
                          {firstMl != null && (
                            <p className="text-muted-foreground text-xs">
                              {firstMl}ml
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress stepper (hidden for cancelled orders) */}
                  {o.status !== "cancelled" && <Stepper status={o.status} />}

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs">Нийт дүн</p>
                      <p className="text-lg font-semibold">
                        {formatPrice(o.total)}
                      </p>
                    </div>
                    <span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
                      Дэлгэрэнгүй
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
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

/** Compact 4-step fulfilment progress bar. */
function Stepper({ status }: { status: OrderStatus }) {
  const current = FLOW.findIndex((s) => s.status === status);
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
