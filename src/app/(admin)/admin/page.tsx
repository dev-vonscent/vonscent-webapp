import { isFeatureEnabled } from "@/lib/feature-flags";
import { getVialOptions } from "@/features/extras/admin-api";
import { vialName } from "@/lib/vials";
import Link from "next/link";
import {
  Boxes,
  AlertTriangle,
  PackageX,
  TrendingUp,
  ArrowRight,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDashboardData,
  getLaunchReadyCount,
  getStockOverview,
  getUnreadNotificationCount,
} from "@/features/admin/api";
import { getProductsByIds, getProductsByTag } from "@/features/products/api";
import { NotificationCard } from "@/features/admin/components/notification-list";
import { formatPrice, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/lib/constants";

/**
 * Самбарын «үлдэгдэл багассан» карт хэдэн мөр асуух вэ. Бүх барааг татахын
 * оронд хамгийн бага үлдэгдэлтэй энэ хэдийг л уншина; цаашийг нь «Бүгд»
 * холбоос барааны жагсаалт руу аваачна.
 */
const DASHBOARD_STOCK_LIMIT = 20;

export default async function AdminDashboard() {
  // Тоолох, эрэмбэлэх ажил SQL-д (0062). Өмнө нь энэ хуудас бүх каталогийг
  // татаж аваад JS дотор шүүдэг байв.
  const vialsOn = await isFeatureEnabled("vial_inventory");
  const [stock, dash, unreadCount, launchReady, vials] = await Promise.all([
    // Alert against each product's own configured threshold (A1) — not a
    // hardcoded figure. Шүүлт нь SQL-д (0065): `items` нь `available_ml`-ээр
    // эрэмбэлэгддэг тул дууссан бараа «бага» бүгдээс ӨМНӨ орно. Хязгаарлаж
    // аваад энд шүүсэн бол дууссан бараа 20 болонгуут жагсаалт хоосорч,
    // дээрх карт «багатай: 35» гэж байхад доор «Сэрэмжлүүлэг алга.» гэж
    // уншигдана.
    getStockOverview({ limit: DASHBOARD_STOCK_LIMIT, state: "low" }),
    getDashboardData(),
    getUnreadNotificationCount(),
    getLaunchReadyCount(),
    // Савны тоон нөөц (0152) — «Цөөхөн үлдсэн сав» картын эх.
    vialsOn ? getVialOptions() : Promise.resolve([]),
  ]);
  const lowVials = vials.filter(
    (v) =>
      v.isActive &&
      v.onHand != null &&
      v.available != null &&
      v.available <= v.lowThreshold,
  );
  const lowStock = stock.items;
  const topSellerIds = dash?.topSellerIds ?? [];
  // Real sales data when there is any. Without it the card falls back to the
  // products tagged «Эрэлттэй» — which is the admin's own guess, not a
  // measurement, so the card has to say which of the two it is showing.
  const hasRealSales = topSellerIds.length > 0;
  const topSellers = hasRealSales
    ? await (async () => {
        // Борлуулалтын дараалал нь SQL-ийнх; `getProductsByIds` id-ийн
        // дарааллыг хадгалдаггүй тул эргүүлэн эрэмбэлнэ.
        const found = await getProductsByIds(topSellerIds.slice(0, 12));
        const byId = new Map(found.map((p) => [p.id, p]));
        return topSellerIds
          .map((id) => byId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .slice(0, 5);
      })()
    : await getProductsByTag("hot", 5);

  const sales = [
    { label: "Өнөөдөр", value: dash?.salesToday ?? 0 },
    { label: "Сүүлийн 7 хоног", value: dash?.sales7d ?? 0 },
    { label: "Сүүлийн 30 хоног", value: dash?.sales30d ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">Хяналтын самбар</h1>

      {/* Хамгийн дээр: юу болсныг эхлээд хэлнэ, тоо баримт нь доор. */}
      <NotificationCard unread={unreadCount} />

      {/* Ус ирсэн мөртлөө «Тун удахгүй» хэвээр (0125) — нөөц нэмэхэд «Дараа»
          дарсныг мартвал агуулахад байгаа ус зарагдахгүй өдөр өнгөрнө. Байхгүй
          үед карт огт харагдахгүй: самбарт хоосон сануулга хэрэггүй. */}
      {launchReady > 0 && (
        <Card className="bg-success/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h2 className="flex items-center gap-2 font-medium">
              <PackageCheck className="text-success size-4" />
              Худалдаанд гаргахад бэлэн {launchReady} ус
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/products?vis=coming_soon">
                Харах <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Савны тоон нөөц (plan §2.1 №13): цөөрсөн сав — самбарын карт л. */}
      {lowVials.length > 0 && (
        <Card className="bg-destructive/5">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">Цөөхөн үлдсэн сав</h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/bottles">
                  Савны нөөц <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-2 text-sm">
              {lowVials.map((v) => (
                <li key={v.id} className="bg-secondary rounded-full px-3 py-1">
                  {vialName(v)} ·{" "}
                  {v.available === 0
                    ? "Дууссан"
                    : `Цөөхөн үлдсэн: ${v.available} ширхэг`}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
              <div key={st} className="bg-muted/40 rounded-lg p-3 text-center">
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          {
            icon: Boxes,
            label: "Нийт бараа",
            value: String(stock.totalProducts),
          },
          {
            icon: AlertTriangle,
            label: "Үлдэгдэл багатай",
            value: String(stock.lowCount),
          },
          {
            icon: PackageX,
            label: "Дууссан",
            value: String(stock.soldoutCount),
          },
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

      {/* `grid-cols-1` (= minmax(0,1fr)) заавал: багана заагаагүй grid-ийн
          мөр нь агуулгынхаа min-content-оор сунадаг тул `truncate` нэрс
          утсан дээр картыг дэлгэцээс гаргаж байв. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:text-gold-strong shrink-0 font-mono"
                    >
                      {o.order_no}
                    </Link>
                    <span className="text-muted-foreground min-w-0 truncate">
                      {formatDateTime(o.created_at)}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatPrice(o.total)}
                    </span>
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
                href="/admin/products?stock=low&sort=stock"
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
                  <li key={p.id}>
                    {/* Straight to the row that can fix it: this list used to
                        name a problem and leave the operator to go find it. */}
                    <Link
                      href={`/admin/products?q=${encodeURIComponent(p.name)}`}
                      className="hover:bg-muted/60 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-sm md:min-h-0 md:py-1"
                    >
                      <span className="min-w-0 truncate">
                        {p.brand} — {p.name}
                      </span>
                      {/* Low stock is a warning, not a failure — `variant="sale"`
                          painted it the same red as «Дууссан» (stock-badge.tsx). */}
                      <Badge className="bg-warning/15 text-warning shrink-0 tabular-nums">
                        {p.availableMl}ml
                      </Badge>
                    </Link>
                  </li>
                ))}
                {/* Жагсаалт хязгаартай. Түүнийг дуугүй нуувал оператор
                    сэрэмжлүүлгийн ЗӨВХӨН эхний хэсгийг харж байгаагаа мэдэхгүй
                    — дээрх картны тоотой зөрсөн нь ойлгомжгүй болно. */}
                {stock.matchedCount > lowStock.length && (
                  <li className="text-muted-foreground pt-1 text-xs">
                    Бусад {stock.matchedCount - lowStock.length} бараа —{" "}
                    <Link
                      href="/admin/products?stock=low&sort=stock"
                      className="underline underline-offset-2"
                    >
                      жагсаалтаас
                    </Link>
                    .
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top sellers */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="font-medium">Эрэлттэй бараа</h2>
            {!hasRealSales && topSellers.length > 0 && (
              <span className="text-muted-foreground text-xs">
                «Эрэлттэй» тагаар
              </span>
            )}
          </div>
          <p className="text-muted-foreground mb-4 text-xs">
            {hasRealSales
              ? "Сүүлийн 30 хоногийн борлуулалтаар."
              : "Борлуулалтын түүх хараахан алга тул та өөрөө тэмдэглэсэн бараа харагдаж байна."}
          </p>
          {topSellers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Захиалга орж эхэлмэгц хамгийн их зарагдсан бараа энд гарна.
              Одоохондоо барааныхаа тагт «Эрэлттэй» гэж тэмдэглэвэл энд
              харагдана.
            </p>
          ) : (
            <ul className="space-y-2">
              {topSellers.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/products?q=${encodeURIComponent(p.name)}`}
                    className="hover:bg-muted/60 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-sm md:min-h-0 md:py-1"
                  >
                    <span className="min-w-0 truncate">
                      {p.brand} — {p.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {formatPrice(p.startingPrice)}-аас
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
