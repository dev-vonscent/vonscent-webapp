import type { Metadata } from "next";
import { getReportData, getAdminProducts } from "@/features/admin/api";
import { getStoreSettings } from "@/features/content/api";
import { PrintButton } from "@/features/admin/components/print-button";
import { formatPrice, formatDate } from "@/lib/format";
import {
  stockState,
  STOCK_STATE_LABEL,
} from "@/features/admin/lib/stock-state";

export const metadata: Metadata = { title: "Тайлан — хэвлэх" };

/**
 * Printable / PDF report (todo.md B8).
 *
 * The browser's own "Save as PDF" is the PDF export: it produces a proper,
 * text-selectable document with the fonts the shop already uses, needs no
 * rendering dependency on the server, and is what the invoice page (A4)
 * already does — one mechanism, not two.
 */
export default async function ReportPrintPage() {
  const [report, products, store] = await Promise.all([
    getReportData(),
    getAdminProducts(),
    getStoreSettings(),
  ]);
  const totalMl = products.reduce((s, p) => s + p.availableMl, 0);
  // Sold-out rows used to land in here as merely "low"; both still need the
  // operator's attention on a printed sheet, so they stay together — but the
  // state column now says which is which.
  const lowStock = products.filter(
    (p) => stockState(p.availableMl, p.lowStockMl) !== "ok",
  );

  return (
    <div className="print-sheet mx-auto max-w-3xl space-y-6 p-2 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-serif text-2xl font-semibold">{store.name}</p>
          <p className="text-muted-foreground">
            Борлуулалт ба үлдэгдлийн тайлан
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">
            {formatDate(new Date().toISOString())}
          </p>
          <PrintButton />
        </div>
      </div>

      <div className="border-border grid grid-cols-3 gap-3 border-y py-4">
        <Stat
          label="Нийт борлуулалт"
          value={formatPrice(report.totalRevenue)}
        />
        <Stat label="Төлсөн захиалга" value={String(report.paidOrders)} />
        <Stat label="Нийт үлдэгдэл" value={`${totalMl}ml`} />
      </div>

      <Table
        title="Эрэлттэй бараа"
        head={["Брэнд", "Нэр", "Тоо", "Орлого"]}
        rows={report.topProducts.map((p) => [
          p.brand,
          p.name,
          String(p.qty),
          formatPrice(p.revenue),
        ])}
      />

      <Table
        title="Эрэлттэй брэнд"
        head={["Брэнд", "Орлого"]}
        rows={report.topBrands.map((b) => [b.brand, formatPrice(b.revenue)])}
      />

      <Table
        title="Анхаарах үлдэгдэл"
        head={["Брэнд", "Нэр", "Үлдэгдэл", "Доод хязгаар", "Төлөв"]}
        rows={lowStock.map((p) => [
          p.brand,
          p.name,
          `${p.availableMl}ml`,
          `${p.lowStockMl}ml`,
          STOCK_STATE_LABEL[stockState(p.availableMl, p.lowStockMl)],
        ])}
        empty="Доод хязгаарт хүрсэн бараа алга."
      />

      <p className="text-muted-foreground text-xs print:hidden">
        PDF болгож хадгалахын тулд «Хэвлэх» дарж, хэвлэгчийн сонголтоос «Save as
        PDF»-ийг сонгоно уу.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-serif text-xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function Table({
  title,
  head,
  rows,
  empty = "Өгөгдөл алга.",
}: {
  title: string;
  head: string[];
  rows: string[][];
  empty?: string;
}) {
  return (
    // break-inside-avoid keeps a short table from being split across pages.
    <section className="break-inside-avoid space-y-2">
      <h2 className="font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <table className="w-full">
          <thead className="border-border text-muted-foreground border-b text-left text-xs">
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`py-1.5 font-medium ${i > 0 && i === head.length - 1 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-border/60 border-b">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`py-1.5 ${j === row.length - 1 ? "text-right" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
