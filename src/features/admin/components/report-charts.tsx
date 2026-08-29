"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
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

export interface MonthlyPoint {
  month: string;
  revenue: number;
  orders: number;
  ml: number;
}

/**
 * Every chart ships the same numbers as a real table for screen readers
 * (WCAG 1.1.1). It is visually hidden but fully in the accessibility tree —
 * `hidden` or `display:none` would defeat the purpose.
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
    <table className="sr-only">
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
  );
}

/** Line chart of monthly revenue; expects points oldest-first. */
export function MonthlySalesChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ChartTable
        caption="Сарын борлуулалт"
        columns={["Сар", "Орлого (₮)", "Захиалга", "ml"]}
        rows={data.map((d) => [d.month, d.revenue, d.orders, d.ml])}
      />
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
          <CartesianGrid stroke="var(--muted)" vertical={false} />
          <XAxis
            dataKey="month"
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

const STATUS_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Donut of order counts per status. */
export function StatusDonut({
  counts,
}: {
  counts: Partial<Record<OrderStatus, number>>;
}) {
  const data = (Object.entries(counts) as [OrderStatus, number][])
    .filter(([, n]) => n > 0)
    .map(([status, n]) => ({
      name: ORDER_STATUS_LABEL[status] ?? status,
      value: n,
    }));

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Өгөгдөл алга.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ChartTable
        caption="Захиалгын төлөв"
        columns={["Төлөв", "Тоо"]}
        rows={data.map((d) => [d.name, d.value])}
      />
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--card)"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface StockPoint {
  name: string;
  availableMl: number;
  lowStockMl: number;
}

/** Horizontal bar chart of the lowest-stock products. */
export function StockBarChart({ data }: { data: StockPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Өгөгдөл алга.</p>;
  }
  return (
    <div className="w-full" style={{ height: Math.max(180, data.length * 34) }}>
      <ChartTable
        caption="Үлдэгдэл багатай бараа"
        columns={["Бараа", "Үлдэгдэл (ml)", "Төлөв"]}
        rows={data.map((d) => [
          d.name,
          d.availableMl,
          STOCK_STATE_LABEL[stockState(d.availableMl, d.lowStockMl)],
        ])}
      />
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke="var(--muted)" horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            unit="ml"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={160}
            tickFormatter={(name: string) => {
              const row = data.find((d) => d.name === name);
              if (!row) return name;
              const state = stockState(row.availableMl, row.lowStockMl);
              return state === "ok"
                ? name
                : `${name} · ${STOCK_STATE_LABEL[state]}`;
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${value ?? 0}ml`, "Үлдэгдэл"]}
          />
          <Bar dataKey="availableMl" name="Үлдэгдэл" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                // Low is a warning, sold out is a failure — the chart painted
                // both `--destructive`, which is the same conflation the
                // dashboard had.
                fill={
                  {
                    soldout: "var(--destructive)",
                    low: "var(--warning)",
                    ok: "var(--chart-2)",
                  }[stockState(d.availableMl, d.lowStockMl)]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
