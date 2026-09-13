import Link from "next/link";
import { Lock, AlertTriangle, Gift, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getReservedMl, type ReservedProduct } from "@/features/admin/api";
import { formatDateTime } from "@/lib/format";
import { formatDeliveryDay } from "@/lib/time";
import { ORDER_STATUS_LABEL, RESERVE_TIMEOUT_MINUTES } from "@/lib/constants";

export const metadata = { title: "Түгжигдсэн мл" };

/**
 * «Захиалагдсан (түгжигдсэн) мл ямар захиалганд байгаа вэ» (backlog §2.4).
 *
 * Барааны жагсаалт «+40ml захиалагдсан» гэж хэлдэг ч аль захиалга түүнийг
 * барьж байгааг харуулдаггүй байсан — oversell хориотой загварт операторын
 * хамгийн магадлалтай асуулт. Энэ хуудас тэр тоог задалж харуулна.
 *
 * Уншилт нь `admin_reserved_ml()` (0075) — «нөөц барьж буй захиалга» гэдгийн
 * тодорхойлолт тэр migration-ий толгойд нэг л газар бичигдсэн.
 */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const rows = await getReservedMl(product);

  const totalReserved = rows.reduce((n, r) => n + r.reservedMl, 0);
  const totalOrders = new Set(
    rows.flatMap((r) => r.orders.map((o) => o.orderId)),
  ).size;
  const mismatched = rows.filter((r) => r.reservedMl !== r.accountedMl);
  // «Хугацаа дууссан» гэдгийг сан шийдсэн (0075) — вэб серверийн цаг
  // санныхаас зөрж болох бөгөөд нөөцийг цуцалдаг cron нь саных.
  const expiredCount = rows.reduce((n, r) => n + r.expiredCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Түгжигдсэн мл"
        description={
          product
            ? "Нэг барааны нөөц. Бүх барааг харахын тулд шүүлтийг цэвэрлэнэ үү."
            : `Төлбөр хүлээж буй захиалгууд нөөцөө ${RESERVE_TIMEOUT_MINUTES} минут барина. Төлөгдсөн захиалгын мл нь аль хэдийн зарлагадсан тул энд харагдахгүй.`
        }
        actions={
          product ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/reservations">Бүх барааг харах</Link>
            </Button>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          surface="card"
          icon={Lock}
          title="Түгжигдсэн мл алга"
          description="Төлбөр хүлээж буй захиалга байхгүй тул бүх үлдэгдэл зарах боломжтой."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/products">Барааны жагсаалт</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat value={`${totalReserved}ml`} label="Нийт түгжигдсэн" />
            <Stat value={String(totalOrders)} label="Хүлээгдэж буй захиалга" />
            <Stat value={String(rows.length)} label="Хамрагдсан бараа" />
            <Stat
              value={String(expiredCount)}
              label="Хугацаа нь дууссан"
              warn={expiredCount > 0}
            />
          </div>

          {mismatched.length > 0 && (
            <Card>
              <CardContent className="text-destructive flex items-start gap-3 p-5 text-sm">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div className="space-y-1">
                  <p className="font-medium">
                    {mismatched.length} бараанд тоолуур ба захиалга зөрж байна
                  </p>
                  <p className="text-muted-foreground">
                    `inventory.reserved_ml` нь нээлттэй захиалгуудаас тоолсон
                    дүнтэй тэнцэх ёстой. Зөрсөн бол тоолуур бодит захиалгаас
                    тасарсан гэсэн үг — доорх мөрүүдэд «зөрүү» гэж тэмдэглэв.
                    Ийм бараа зарагдах мл нь бодитоос бага (эсвэл их) харагдана.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {expiredCount > 0 && (
            <Card>
              <CardContent className="flex items-start gap-3 p-5 text-sm">
                <Clock
                  className="text-warning mt-0.5 size-5 shrink-0"
                  aria-hidden
                />
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {expiredCount} захиалгын нөөцийн хугацаа дууссан
                  </span>{" "}
                  — `release_expired_reserves` (pg_cron) дараагийн ажиллахдаа
                  тэднийг цуцалж, мл-ийг буцаана. Хэрэв удаан хугацаагаар энд
                  үлдэж байвал cron ажиллахаа больсон гэсэн үг.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {rows.map((row) => (
              <ProductReservations key={row.productId} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProductReservations({ row }: { row: ReservedProduct }) {
  const mismatch = row.reservedMl !== row.accountedMl;
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              <Link
                href={`/admin/products/${row.productId}/edit`}
                className="hover:underline"
              >
                {row.brand} — {row.name}
              </Link>
            </p>
            <p className="text-muted-foreground text-sm">
              Боломжит {row.availableMl}ml · Савандаа {row.onHandMl}ml
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!row.isActive && <Badge variant="secondary">Нуусан</Badge>}
            {mismatch && (
              <Badge variant="sale">
                Зөрүү: тоолуур {row.reservedMl}ml, захиалга {row.accountedMl}ml
              </Badge>
            )}
            <Badge variant="outline" className="tabular-nums">
              {row.reservedMl}ml түгжигдсэн
            </Badge>
          </div>
        </div>

        {row.orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Нөөц барьж буй нээлттэй захиалга алга — тоолуур ганцаараа үлдсэн
            байна.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-sm">
              <caption className="sr-only">
                {row.brand} {row.name} — нөөц барьж буй захиалгууд
              </caption>
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="pb-2 font-medium">
                    Захиалга
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Худалдан авагч
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Төлөв
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Хүргэх өдөр
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Нөөц дуусах
                  </th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Түгжсэн
                  </th>
                </tr>
              </thead>
              <tbody>
                {row.orders.map((o) => (
                  <tr key={o.orderId} className="even:bg-muted/40">
                    <th scope="row" className="py-2 text-left font-medium">
                      <Link
                        href={`/admin/orders/${o.orderId}`}
                        className="hover:underline"
                      >
                        #{o.orderNo}
                      </Link>
                      <span className="text-muted-foreground block text-xs font-normal">
                        {formatDateTime(o.createdAt)}
                      </span>
                    </th>
                    <td className="py-2">
                      {o.contactName}
                      <span className="text-muted-foreground block text-xs">
                        {o.contactPhone}
                      </span>
                    </td>
                    <td className="py-2">
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </td>
                    <td className="text-muted-foreground py-2">
                      {o.deliverOn ? formatDeliveryDay(o.deliverOn) : "—"}
                    </td>
                    <td className="py-2">
                      {o.reserveExpiresAt ? (
                        // `formatTimeAgo` нь ирээдүйн агшинг «саяхан»
                        // болгон хумьдаг тул энд тохирохгүй — нөөцийн
                        // хугацаа нь ихэвчлэн ИРЭЭДҮЙД байна.
                        <span className={o.isExpired ? "text-warning" : ""}>
                          {formatDateTime(o.reserveExpiresAt)}
                          {o.isExpired && " · дууссан"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Хугацаагүй
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {o.ml}ml
                      {o.hasGift && (
                        <Gift
                          className="text-muted-foreground ml-1 inline size-3.5"
                          aria-label="Бэлгийн мөр багтсан"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  value,
  label,
  warn = false,
}: {
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p
          className={`font-serif text-2xl font-semibold ${warn ? "text-warning" : ""}`}
        >
          {value}
        </p>
        <p className="text-muted-foreground text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}
