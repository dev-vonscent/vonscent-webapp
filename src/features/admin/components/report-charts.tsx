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

/**
 * Report/dashboard charts (recharts). Series colors come from the theme's
 * --chart-N variables so all three admin themes stay coherent.
 */

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--ring)",
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

/** Line chart of monthly revenue; expects points oldest-first. */
export function MonthlySalesChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-72 w-full">
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
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${value ?? 0}ml`, "Үлдэгдэл"]}
          />
          <Bar dataKey="availableMl" name="Үлдэгдэл" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.availableMl <= d.lowStockMl
                    ? "var(--destructive)"
                    : "var(--chart-2)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
