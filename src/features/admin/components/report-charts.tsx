"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatPrice } from "@/lib/format";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  stockState,
  STOCK_STATE_LABEL,
} from "@/features/admin/lib/stock-state";

/**
 * Report/dashboard charts (recharts). Series colors come from the theme's
 * --chart-N variables so all three admin themes stay coherent.
 */

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  // `border` is collapsed globally; a box-shadow gives the tooltip its edge.
  boxShadow: "0 0 0 1px var(--ring), var(--shadow-lift)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function compactMnt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}сая`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}мянга`;
  return String(v);
}

export interface SeriesPoint {
  /** Тэнхлэгт харагдах бичиг («9-р сар» эсвэл «9/13»). */
  label: string;
  revenue: number;
  orders: number;
  ml: number;
}

/**
 * Every chart ships the same numbers as a real table for screen readers
 * (WCAG 1.1.1). It is visually hidden but fully in the accessibility tree —
 * `hidden` or `display:none` would defeat the purpose.
 *
 * `sr-only` нь хүснэгт дээр БИШ, гаднах div дээр: `<table>` нь `width:1px` ба
 * `overflow:hidden`-ийг үл тоож агуулгынхаа өргөнөөр тэлдэг, `clip-path`
 * нь зөвхөн нүднээс нуудаг тул үл үзэгдэх хүснэгт утсан дээр хуудсыг
 * дэлгэцээс өргөн болгож, тайланг бүхэлд нь жижигрүүлж харуулдаг байв.
 */
function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Борлуулалтын хугацааны график; цэгүүд нь ХУУЧНААС ШИНЭ рүү эрэмбэлэгдсэн
 * байх ёстой. Хэрчим нь сар ч байж болно, өдөр ч байж болно (`caption`
 * хоёуланг нь ялгаж хэлнэ) — тайлангийн муж богино үед өдрөөр бүлэглэдэг.
 */
export function SalesSeriesChart({
  data,
  caption,
  bucketLabel,
}: {
  data: SeriesPoint[];
  caption: string;
  /** Хүснэгтийн эхний баганын толгой («Сар» / «Өдөр»). */
  bucketLabel: string;
}) {
  return (
    <div className="h-72 w-full">
      <ChartTable
        caption={caption}
        columns={[bucketLabel, "Орлого (₮)", "Захиалга", "ml"]}
        rows={data.map((d) => [d.label, d.revenue, d.orders, d.ml])}
      />
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
          <CartesianGrid stroke="var(--muted)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--muted)" }}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactMnt}
            width={70}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) =>
              name === "Борлуулалт"
                ? [formatPrice(Number(value ?? 0)), name]
                : [value ?? 0, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Борлуулалт"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--chart-1)" }}
          />
          <Line
            type="monotone"
            dataKey="orders"
            name="Захиалга"
            stroke="var(--chart-3)"
            strokeWidth={1.5}
            dot={false}
            yAxisId={0}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface StockPoint {
  name: string;
  /**
   * Барааны жагсаалтын хайлт руу дамжих текст. «Брэнд — Нэр» дэх «—» нь
   * хайлтын нэг үг болж таарахгүй тул брэнд, нэрийг зайгаар л залгана.
   */
  searchQuery: string;
  availableMl: number;
  lowStockMl: number;
}

/**
 * Хамгийн бага үлдэгдэлтэй бараанууд — recharts биш, HTML мөрүүд.
 *
 * Recharts-ийн хэвтээ bar-т гурван асуудал байв: урт нэр Y тэнхлэгт 3 мөр
 * болж хөршөөрөө давхцдаг, hover-ын cursor нь бүтэн мөрийг цайвар саарал
 * зурвасаар бүрхдэг, tooltip-ийн утга хар theme-д харанхуй өнгөтэй гардаг.
 * Мөн 0ml бараа (яг анхаарах ёстой нь) зураасгүй тул хоосон харагддаг байв.
 * Энд утга бүр шууд бичигдсэн тул tooltip хэрэггүй, нэр 2 мөрөөс хэтэрвэл тасарна.
 *
 * Өнгө нь зөвхөн төлөв: «Бага» — улаан, «Дууссан» — хоосон зам + улаан
 * тэмдэг, хэвийн — ногоон (`--done`; монохром `success` нь саарал).
 * Нэр дээр дарвал барааны жагсаалт тухайн бараагаар хайгдсан нээгдэнэ. Тэмдэг (үг) байгаа тул өнгө дангаараа
 * утга тээхгүй. Зам дээрх босоо зураас нь тухайн барааны «бага» босго.
 */
export function StockBarChart({ data }: { data: StockPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Өгөгдөл алга.</p>;
  }
  // Босго ч хуваарьт багтах ёстой — эс бөгөөс бага үлдэгдэлтэй бараан дээр
  // зураас замаас гадагш гарна.
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.availableMl, d.lowStockMl)),
  );
  const pct = (ml: number) => `${Math.min(100, (ml / max) * 100)}%`;

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-x-10 gap-y-3.5 lg:grid-cols-2">
        {data.map((d) => {
          const state = stockState(d.availableMl, d.lowStockMl);
          return (
            <li key={d.name} className="min-w-0">
              <div className="flex items-start gap-2 text-sm">
                <Link
                  href={`/admin/products?q=${encodeURIComponent(d.searchQuery)}`}
                  className="line-clamp-2 min-w-0 flex-1 wrap-break-word underline-offset-4 hover:underline"
                >
                  {d.name}
                </Link>
                {state !== "ok" && (
                  <Badge variant="sale">{STOCK_STATE_LABEL[state]}</Badge>
                )}
                <span
                  className={cn(
                    "w-14 shrink-0 text-right font-medium tabular-nums",
                    state === "soldout" && "text-destructive",
                  )}
                >
                  {d.availableMl}ml
                </span>
              </div>
              <div
                aria-hidden
                className="bg-muted relative mt-1.5 h-1.5 overflow-hidden rounded-full"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    state === "low" ? "bg-destructive" : "bg-done",
                  )}
                  style={{ width: pct(d.availableMl) }}
                />
                {d.lowStockMl > 0 && (
                  <div
                    className="bg-foreground/50 absolute inset-y-0 w-0.5"
                    style={{ left: pct(d.lowStockMl) }}
                  />
                )}
              </div>
              <span className="sr-only">
                Бага үлдэгдлийн босго {d.lowStockMl}ml.
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <span aria-hidden className="bg-foreground/50 inline-block h-3 w-0.5" />
        Босоо зураас — тухайн барааны «Бага» босго
      </p>
    </div>
  );
}
