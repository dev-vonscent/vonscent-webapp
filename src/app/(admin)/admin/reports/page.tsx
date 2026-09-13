import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getReportData,
  getStockOverview,
  type ReportRange,
} from "@/features/admin/api";
import {
  SalesSeriesChart,
  StatusDonut,
  StockBarChart,
} from "@/features/admin/components/report-charts";
import { DateRangeFilter } from "@/features/admin/components/date-range-filter";
import {
  REPORT_DATE_PRESETS,
  bucketLabel,
  rangeSummary,
} from "@/features/admin/lib/date-range";
import { PageHeader } from "@/components/shared/page-header";
import { formatPrice } from "@/lib/format";

/** Графикт харуулах «хамгийн бага үлдэгдэлтэй» барааны тоо. */
const REPORT_STOCK_LIMIT = 10;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const range: ReportRange = { from, to };

  // Нийт мл ба «хамгийн бага үлдэгдэлтэй 10» хоёуланг SQL өгнө (0062) — өмнө
  // нь бүх каталогийг татаж аваад JS дотор нийлбэр, эрэмбэ хийдэг байв.
  //
  // Үлдэгдэл нь ХУГАЦААНААС ХАМААРАХГҮЙ: «энэ сарын үлдэгдэл» гэж байхгүй,
  // үлдэгдэл нь үргэлж ОДООГИЙНХ. Тиймээс `getStockOverview` муж авахгүй —
  // харин хуудас дээр тэр хоёр блок нь хугацааны шүүлтэд захирагддаггүйг
  // бичиж хэлнэ.
  const [report, stock] = await Promise.all([
    getReportData(range),
    getStockOverview({ limit: REPORT_STOCK_LIMIT, activeOnly: true }),
  ]);
  const totalMl = stock.totalAvailableMl;
  // `admin_report_series` шинэ нь түрүүлж өгдөг; цагийн тэнхлэг эсрэгээр.
  const seriesAsc = [...report.series].reverse().map((d) => ({
    label: bucketLabel(d.bucket),
    revenue: d.revenue,
    orders: d.orders,
    ml: d.ml,
  }));
  const bucketHead = report.bucket === "day" ? "Өдөр" : "Сар";
  const lowestStock = stock.items.map((p) => ({
    name: `${p.brand} — ${p.name}`,
    availableMl: p.availableMl,
    lowStockMl: p.lowStockMl,
  }));
  const summary = rangeSummary(from, to);
  // Экспорт, хэвлэх хоёр нь харж буй мужаа дагах ёстой — эс бөгөөс дэлгэц
  // дээрх тоо ба татсан файл хоёр зөрнө.
  const rangeQs = new URLSearchParams();
  if (from) rangeQs.set("from", from);
  if (to) rangeQs.set("to", to);
  const qs = rangeQs.toString();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Тайлан"
        description={summary}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              {/* Opens the print view; the browser's Save-as-PDF is the export
                  (todo.md B8) — same mechanism as the order invoice. */}
              <Link
                href={
                  qs ? `/admin/reports/print?${qs}` : "/admin/reports/print"
                }
                target="_blank"
              >
                <FileText className="size-4" /> PDF / Хэвлэх
              </Link>
            </Button>
            <ExportButton type="sales" label="Борлуулалт" qs={qs} />
            <ExportButton type="products" label="Бараа" qs={qs} />
            <ExportButton type="inventory" label="Үлдэгдэл" qs={qs} />
          </>
        }
      />

      <div className="bg-card rounded-lg p-3">
        <DateRangeFilter
          from={from}
          to={to}
          params={{}}
          basePath="/admin/reports"
          presets={REPORT_DATE_PRESETS}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          value={formatPrice(report.totalRevenue)}
          label="Борлуулалт (хүргэлт, купон, оноо хассан)"
        />
        <Stat
          value={formatPrice(report.totalCost)}
          label={
            from || to
              ? "Энэ хугацааны зардал (эх сав + restock)"
              : "Зардал (эх сав + restock)"
          }
        />
        <Stat
          value={formatPrice(report.profit)}
          label="Ашиг"
          negative={report.profit < 0}
        />
        <Stat value={String(report.paidOrders)} label="Төлсөн захиалга" />
        {/* Үлдэгдэл нь ОДООГИЙНХ — доорх тэмдэглэгээ нь хугацааны шүүлт
            үүнд хамаарахгүйг хэлнэ. */}
        <Stat value={`${totalMl}ml`} label="Нийт үлдэгдэл (одоо)" />
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-medium">
            {report.bucket === "day"
              ? "Өдөр бүрийн борлуулалт"
              : "Сар бүрийн борлуулалт"}
          </h2>
          {report.series.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Энэ хугацаанд төлөгдсөн захиалга алга.
            </p>
          ) : (
            <>
              <SalesSeriesChart
                data={seriesAsc}
                caption={`Борлуулалт — ${summary}`}
                bucketLabel={bucketHead}
              />
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-105 text-sm">
                  <caption className="sr-only">
                    Борлуулалт {bucketHead.toLowerCase()} тус бүрээр — {summary}
                  </caption>
                  <thead className="text-muted-foreground text-left text-xs">
                    <tr>
                      <th scope="col" className="pb-2 font-medium">
                        {bucketHead}
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Захиалга
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Зарсан мл
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Борлуулалт
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.series.map((m) => (
                      <tr key={m.bucket} className="even:bg-muted/40">
                        <th scope="row" className="py-2 text-left font-medium">
                          {m.bucket}
                        </th>
                        <td className="py-2">{m.orders}</td>
                        <td className="py-2">{m.ml}ml</td>
                        <td className="py-2 text-right font-medium">
                          {formatPrice(m.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-medium">Захиалгын төлөв</h2>
            {/* Төлвийн тоо нь мужид хамаарна (0074) — өмнө нь энэ бялуу
                самбарын «бүх цаг үе»-ийн тоог харуулдаг байсан тул дээрх
                тоонуудтай зөрж болох байв. */}
            <StatusDonut counts={report.statusCounts} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-medium">
              Хамгийн бага үлдэгдэлтэй{" "}
              <span className="text-muted-foreground text-xs font-normal">
                (одоогийн байдлаар)
              </span>
            </h2>
            <StockBarChart data={lowestStock} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-medium">Эрэлттэй бараа</h2>
            {report.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Өгөгдөл алга.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {report.topProducts.map((p) => (
                  <li
                    key={`${p.brand}-${p.name}`}
                    className="flex justify-between"
                  >
                    <span>
                      {p.brand} — {p.name}{" "}
                      <span className="text-muted-foreground">×{p.qty}</span>
                    </span>
                    <span className="font-medium">
                      {formatPrice(p.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-medium">Эрэлттэй брэнд</h2>
            {report.topBrands.length === 0 ? (
              <p className="text-muted-foreground text-sm">Өгөгдөл алга.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {report.topBrands.map((b) => (
                  <li key={b.brand} className="flex justify-between">
                    <span>{b.brand}</span>
                    <span className="font-medium">
                      {formatPrice(b.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  negative = false,
}: {
  value: string;
  label: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p
          className={`font-serif text-2xl font-semibold ${
            negative ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        <p className="text-muted-foreground text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

function ExportButton({
  type,
  label,
  qs,
}: {
  type: string;
  label: string;
  qs: string;
}) {
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={`/api/admin/reports/export?type=${type}${qs ? `&${qs}` : ""}`}>
        <Download className="size-4" /> {label} CSV
      </a>
    </Button>
  );
}
