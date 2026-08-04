import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getReportData, getAdminProducts } from "@/features/admin/api";
import { formatPrice } from "@/lib/format";

export default async function AdminReportsPage() {
  const [report, products] = await Promise.all([
    getReportData(),
    getAdminProducts(),
  ]);
  const totalMl = products.reduce((s, p) => s + p.availableMl, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">Тайлан</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            {/* Opens the print view; the browser's Save-as-PDF is the export
                (todo.md B8) — same mechanism as the order invoice. */}
            <Link href="/admin/reports/print" target="_blank">
              <FileText className="size-4" /> PDF / Хэвлэх
            </Link>
          </Button>
          <ExportButton type="sales" label="Борлуулалт" />
          <ExportButton type="products" label="Бараа" />
          <ExportButton type="inventory" label="Үлдэгдэл" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="font-serif text-2xl font-semibold">
              {formatPrice(report.totalRevenue)}
            </p>
            <p className="text-sm text-muted-foreground">Нийт борлуулалт</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="font-serif text-2xl font-semibold">{report.paidOrders}</p>
            <p className="text-sm text-muted-foreground">Төлсөн захиалга</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="font-serif text-2xl font-semibold">{totalMl}ml</p>
            <p className="text-sm text-muted-foreground">Нийт үлдэгдэл</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-medium">Сар бүрийн борлуулалт</h2>
          {report.monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground">Өгөгдөл алга.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Сар</th>
                    <th className="pb-2 font-medium">Захиалга</th>
                    <th className="pb-2 font-medium">Заралсан ml</th>
                    <th className="pb-2 text-right font-medium">Борлуулалт</th>
                  </tr>
                </thead>
                <tbody>
                  {report.monthly.map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <td className="py-2 font-medium">{m.month}</td>
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
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-medium">Эрэлттэй бараа</h2>
            {report.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Өгөгдөл алга.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {report.topProducts.map((p) => (
                  <li key={`${p.brand}-${p.name}`} className="flex justify-between">
                    <span>
                      {p.brand} — {p.name}{" "}
                      <span className="text-muted-foreground">×{p.qty}</span>
                    </span>
                    <span className="font-medium">{formatPrice(p.revenue)}</span>
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
              <p className="text-sm text-muted-foreground">Өгөгдөл алга.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {report.topBrands.map((b) => (
                  <li key={b.brand} className="flex justify-between">
                    <span>{b.brand}</span>
                    <span className="font-medium">{formatPrice(b.revenue)}</span>
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

function ExportButton({ type, label }: { type: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/admin/reports/export?type=${type}`}>
        <Download className="size-4" /> {label} CSV
      </a>
    </Button>
  );
}
