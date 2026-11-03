"use client";

import * as React from "react";
import { Crown, HeartCrack, Package, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SpinType } from "@/db/types";
import type {
  WheelPrizeReportRow,
  WheelReport,
  WheelReportFilter,
} from "@/features/admin/api";
import { DateRangeFilter } from "./date-range-filter";
import { FilterChip } from "./filter-chip";

const BASE = "/admin/lucky-wheel/report";

const TYPE_CHIPS: { value: SpinType | undefined; label: string }[] = [
  { value: undefined, label: "Бүх эргэлт" },
  { value: "free", label: "Үнэгүй" },
  { value: "order", label: "Захиалгын эрхээр" },
  { value: "paid", label: "Пойнтоор" },
];

type Group = "all" | "coupon" | "points" | "physical" | "none";

const GROUPS: { value: Group; label: string }[] = [
  { value: "all", label: "Бүгд" },
  { value: "coupon", label: "Купон" },
  { value: "points", label: "V point" },
  { value: "physical", label: "Бодит шагнал" },
  { value: "none", label: "Хоосон" },
];

function groupOf(
  kind: WheelPrizeReportRow["kind"],
): Exclude<Group, "all"> {
  if (kind === "coupon_fixed" || kind === "coupon_percent") return "coupon";
  if (kind === "points") return "points";
  if (kind === "bundle" || kind === "product") return "physical";
  return "none";
}

const ICON = {
  coupon: Ticket,
  points: VPointIcon,
  physical: Package,
  none: HeartCrack,
} as const;

const n = (v: number) => v.toLocaleString("mn-MN");

/** The URL for this page with `patch` applied to the current filter. */
function hrefWith(filter: WheelReportFilter, patch: WheelReportFilter): string {
  const next = { ...filter, ...patch };
  const qs = new URLSearchParams();
  if (next.from) qs.set("from", next.from);
  if (next.to) qs.set("to", next.to);
  if (next.type) qs.set("type", next.type);
  const s = qs.toString();
  return s ? `${BASE}?${s}` : BASE;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** «label: value» pairs under a prize — only the ones that say something. */
function Facts({ items }: { items: [string, string, string?][] }) {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map(([label, value, tone]) => (
        <div key={label} className="flex gap-1">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={cn("font-semibold tabular-nums", tone)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrizeRow({ row, total }: { row: WheelPrizeReportRow; total: number }) {
  const group = groupOf(row.kind);
  const Icon = row.kind === "bundle" ? Crown : ICON[group];
  const share = total > 0 ? (row.count / total) * 100 : 0;
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {row.label}
        </span>
        {row.tier !== "common" && (
          <Badge variant={row.tier === "grand" ? "gold" : "secondary"}>
            {row.tier === "grand" ? "Гранд" : "Ховор"}
          </Badge>
        )}
        <span className="text-sm font-semibold tabular-nums">
          {n(row.count)} удаа
        </span>
        <span className="text-muted-foreground w-14 text-right text-xs tabular-nums">
          {share.toFixed(1)}%
        </span>
      </div>

      {group === "coupon" && (
        <Facts
          items={[
            ["Олгосон", n(row.couponsIssued)],
            ["Ашигласан", n(row.couponsUsed), "text-gold-strong"],
            ["Хүчинтэй", n(row.couponsOpen)],
            ["Хугацаа дууссан", n(row.couponsExpired), "text-muted-foreground"],
            ["Хөнгөлөлт", formatPrice(row.discount)],
          ]}
        />
      )}
      {group === "points" && (
        <Facts items={[["Олгосон", `${n(row.value * row.count)}V`]]} />
      )}
      {group === "physical" && (
        <Facts
          items={[
            ["Хүлээгдэж буй", n(row.physicalWaiting), "text-gold-strong"],
            ["Захиалгад", n(row.physicalInOrder)],
            ["Хүргэгдсэн", n(row.physicalDelivered)],
            [
              "Хугацаа дууссан",
              n(row.physicalExpired),
              "text-muted-foreground",
            ],
          ]}
        />
      )}
    </li>
  );
}

/**
 * The wheel's report (0170): which spins (date range, entitlement) and, per
 * prize, how often it landed and what became of it — coupons used or lapsed,
 * points paid out, parcels owed or delivered.
 */
export function LuckyWheelReport({
  report,
  filter,
  summary,
}: {
  report: WheelReport;
  filter: WheelReportFilter;
  /** «2026-10-01 — 2026-10-31» / «Бүх хугацаа». */
  summary: string;
}) {
  const [group, setGroup] = React.useState<Group>("all");
  const rows = report.prizes.filter(
    (r) => group === "all" || groupOf(r.kind) === group,
  );
  const coupons = report.prizes.filter((r) => groupOf(r.kind) === "coupon");
  const couponsIssued = coupons.reduce((s, r) => s + r.couponsIssued, 0);
  const couponsUsed = coupons.reduce((s, r) => s + r.couponsUsed, 0);

  return (
    <section className="space-y-4">
      <p className="text-muted-foreground text-xs">{summary}</p>

      <div className="space-y-3">
        <DateRangeFilter
          from={filter.from}
          to={filter.to}
          params={{ type: filter.type }}
          basePath={BASE}
          presetSet="reports"
        />
        <div className="flex flex-wrap gap-2">
          {TYPE_CHIPS.map((c) => (
            <FilterChip
              key={c.label}
              label={c.label}
              href={hrefWith(filter, { type: c.value })}
              active={filter.type === c.value}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Нийт эргэлт"
          value={n(report.spins)}
          hint={`${n(report.freeSpins)} үнэгүй · ${n(report.orderSpins)} захиалгаар · ${n(report.paidSpins)} пойнтоор`}
        />
        <Stat
          label="Хоосон дээр буусан"
          value={n(report.misses)}
          hint={
            report.spins > 0
              ? `${((report.misses / report.spins) * 100).toFixed(1)}%`
              : undefined
          }
        />
        <Stat
          label="Олгосон V point"
          value={n(report.pointsAwarded)}
          hint={`${n(report.pointsSpent)}V зарцуулагдсан · цэвэр ${n(report.pointsAwarded - report.pointsSpent)}`}
        />
        <Stat
          label="Олгосон купон"
          value={n(couponsIssued)}
          hint={`${n(couponsUsed)} нь ашиглагдсан`}
        />
        <Stat
          label="Захиалгаас олгосон эрх"
          value={n(report.orderSpinsGranted)}
          hint="Цуцлагдсан захиалгынх ороогүй"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGroup(g.value)}
            aria-pressed={group === g.value}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              group === g.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Энэ хугацаанд эргэлт алга.
            </p>
          ) : (
            <ul className="divide-muted/60 divide-y">
              {rows.map((r) => (
                <PrizeRow
                  key={`${r.kind}:${r.value}:${r.label}`}
                  row={r}
                  total={report.spins}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
