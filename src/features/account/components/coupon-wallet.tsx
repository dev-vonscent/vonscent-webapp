"use client";

import * as React from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LUCKY_WHEEL_HIDDEN } from "@/lib/constants";
import { useWallet } from "../use-coupons";
import { markSeen } from "../use-new-badge";
import {
  couponTerms,
  daysLeft,
  describeRedemption,
  sortForTab,
  type CouponStatus,
  type WalletCoupon,
} from "./coupons";
import {
  STUB_RATIO,
  TicketOutline,
  TicketStub,
  couponLabel,
} from "./coupon-ticket";
import { CopyCodeButton } from "./coupon-actions";

const TABS: { value: CouponStatus; label: string }[] = [
  { value: "active", label: "Идэвхтэй" },
  { value: "used", label: "Ашиглагдсан" },
  { value: "expired", label: "Хугацаа дууссан" },
];

const EMPTY: Record<CouponStatus, { title: string; description: string }> = {
  active: {
    title: "Одоогоор идэвхтэй купон алга",
    description: "Шинэ купон авмагц энд гарч ирнэ.",
  },
  used: {
    title: "Ашигласан купон алга",
    description: "Та эсвэл найз тань купоноо ашиглавал энд харагдана.",
  },
  expired: {
    title: "Хугацаа дууссан купон алга",
    description: "Хугацаа нь дууссан купонууд энд хадгалагдана.",
  },
};

/**
 * «Миний купон» — every coupon issued to this customer, one row each.
 *
 * Nothing is merged (0104): two 10% coupons that end on different days are two
 * rows, each with its own date. Campaign codes (`WELCOME11` and the like) are
 * not listed — they work by code alone, for whoever was told the code.
 *
 * A used coupon moves to «Ашиглагдсан» with a masked line saying who used it
 * and when — the code still works for anyone signed in who types it (0104).
 *
 * A minimum order is its own line, not a footnote: it is the condition that
 * decides whether the coupon applies to the cart at all.
 */
export function CouponWallet() {
  const { data, isPending, isError, refetch } = useWallet();
  const [tab, setTab] = React.useState<CouponStatus>("active");

  // Visiting the page is what retires the «Шинэ» badge in the menus.
  React.useEffect(() => markSeen("coupons"), []);

  const coupons = React.useMemo(() => data ?? [], [data]);
  const count = (s: CouponStatus) =>
    coupons.filter((c) => c.status === s).length;
  const rows = React.useMemo(() => sortForTab(coupons, tab), [coupons, tab]);

  return (
    <div className="space-y-5">
      <h1 className="hidden font-serif text-2xl font-semibold md:block">
        Миний купон
      </h1>

      <div
        role="tablist"
        aria-label="Купоны төлөв"
        className="bg-secondary flex gap-1 rounded-xl p-1 text-sm"
      >
        {TABS.map((t) => {
          const n = count(t.value);
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "flex-1 rounded-lg p-2 font-medium transition-colors",
                tab === t.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {n > 0 && (
                <span className="text-muted-foreground ml-1 tabular-nums">
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="bg-secondary h-28 animate-pulse rounded-2xl"
            />
          ))}
        </ul>
      ) : isError ? (
        <EmptyState
          icon={Ticket}
          title="Купоныг ачаалж чадсангүй"
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Дахин оролдох
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={EMPTY[tab].title}
          description={EMPTY[tab].description}
          action={
            tab === "active" && !LUCKY_WHEEL_HIDDEN ? (
              <Button asChild>
                <Link href="/lucky-wheel">Азын хүрд эргүүлэх</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <CouponRow coupon={c} />
            </li>
          ))}
        </ul>
      )}

      {tab === "active" && rows.length > 0 && (
        <p className="text-muted-foreground text-xs/relaxed">
          Нэг захиалгад нэг купон.
        </p>
      )}
    </div>
  );
}

function CouponRow({ coupon: c }: { coupon: WalletCoupon }) {
  const label = couponLabel(c.type, c.value);
  const terms = couponTerms(c);
  const last = c.redemptions[0];

  return (
    <article className="bg-card flex gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4">
      <Link
        href={`/account/coupons/${encodeURIComponent(c.code)}`}
        aria-label={`${label} купоны дэлгэрэнгүй`}
        className={cn(
          "relative aspect-video w-24 shrink-0 transition-transform duration-300 hover:-translate-y-0.5 sm:w-32",
          c.status === "active"
            ? "text-muted-foreground/50"
            : "text-muted-foreground/30 opacity-70",
        )}
      >
        <TicketOutline />
        <TicketStub className="text-muted-foreground/70" />
        <span
          className="absolute inset-y-0 right-0 flex items-center justify-center"
          style={{ left: `${STUB_RATIO * 100}%` }}
        >
          <span className="text-foreground font-serif text-lg leading-none font-semibold sm:text-xl">
            {label}
          </span>
        </span>
      </Link>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate font-mono text-sm font-semibold tracking-wider">
          {c.code}
        </p>
        <p className="text-muted-foreground text-xs">
          <ExpiryLine coupon={c} />
        </p>
        {terms && (
          <p className="text-foreground text-xs font-medium">{terms}</p>
        )}

        {c.status === "used" && last && (
          <p className="text-xs">
            <span className="text-muted-foreground">Ашигласан: </span>
            {describeRedemption(last)}
            <span className="text-muted-foreground">
              {" "}
              · {formatDate(last.at)}
            </span>
          </p>
        )}

        {c.status === "active" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <CopyCodeButton code={c.code} />
          </div>
        )}
      </div>
    </article>
  );
}

function ExpiryLine({ coupon: c }: { coupon: WalletCoupon }) {
  if (!c.endsAt) return <>Хугацаагүй</>;
  if (c.status !== "active") return <>{formatDate(c.endsAt)} хүртэл байсан</>;
  const days = daysLeft(c.endsAt);
  if (days != null && days <= 7) {
    return (
      <span className={cn(days <= 3 && "text-destructive font-medium")}>
        {days <= 1 ? "Өнөөдөр дуусна" : `${days} хоног үлдсэн`}
      </span>
    );
  }
  return <>{formatDate(c.endsAt)} хүртэл</>;
}
