import Link from "next/link";
import {
  Boxes,
  AlertTriangle,
  PackageX,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllProducts } from "@/features/products/api";
import { getDashboardData } from "@/features/admin/api";
import { formatPrice, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/lib/constants";

export default async function AdminDashboard() {
  const [products, dash] = await Promise.all([
    getAllProducts(),
    getDashboardData(),
  ]);
  const lowStock = products.filter(
    (p) => p.availableMl > 0 && p.availableMl <= 20,
  );
  const soldOut = products.filter((p) => p.availableMl <= 0);
  const topSellers = products.filter((p) => p.tags.includes("hot")).slice(0, 5);

  const sales = [
    { label: "Өнөөдөр", value: dash?.salesToday ?? 0 },
    { label: "Сүүлийн 7 хоног", value: dash?.sales7d ?? 0 },
    { label: "Сүүлийн 30 хоног", value: dash?.sales30d ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Хяналтын самбар</h1>

      {/* Sales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {sales.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <TrendingUp className="text-muted-foreground size-5" />
              <p className="mt-3 font-serif text-2xl font-semibold">
                {formatPrice(s.value)}
              </p>
              <p className="text-muted-foreground text-sm">
                {s.label} борлуулалт
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order status counts */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Захиалга төлөвөөр</h2>
            <Link
              href="/admin/orders"
              className="text-gold-strong flex items-center gap-1 text-sm hover:underline"
            >
              Бүгд <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ORDER_STATUSES.map((st) => (
              <div
                key={st}
                className="border-border rounded-lg border p-3 text-center"
              >
                <p className="font-serif text-xl font-semibold">
                  {dash?.statusCounts[st] ?? 0}
                </p>
                <p className="text-muted-foreground text-xs">
                  {ORDER_STATUS_LABEL[st]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inventory quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Boxes, label: "Нийт бараа", value: String(products.length) },
          {
            icon: AlertTriangle,
            label: "Үлдэгдэл багатай",
            value: String(lowStock.length),
          },
          { icon: PackageX, label: "Дууссан", value: String(soldOut.length) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <s.icon className="text-muted-foreground size-5" />
              <p className="mt-3 font-serif text-2xl font-semibold">
                {s.value}
              </p>
              <p className="text-muted-foreground text-sm">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-medium">Сүүлийн захиалга</h2>
            {!dash || dash.recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">Захиалга алга.</p>
            ) : (
              <ul className="space-y-2">
                {dash.recentOrders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:text-gold-strong font-mono"
                    >
                      {o.order_no}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatDate(o.created_at)}
                    </span>
                    <span className="font-medium">{formatPrice(o.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">Үлдэгдэл багассан</h2>
              <Link
                href="/admin/inventory"
                className="text-gold-strong flex items-center gap-1 text-sm hover:underline"
              >
                Бүгд <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Сэрэмжлүүлэг алга.
              </p>
            ) : (
              <ul className="space-y-2">
                {lowStock.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {p.brand} — {p.name}
                    </span>
                    <Badge variant="sale">{p.availableMl}ml</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top sellers */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-medium">Эрэлттэй бараа</h2>
          <ul className="space-y-2">
            {topSellers.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {p.brand} — {p.name}
                </span>
                <span className="text-muted-foreground">
                  {formatPrice(p.startingPrice)}-аас
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
