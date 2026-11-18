"use client";

import * as React from "react";
import Link from "next/link";
import { Share2, Ticket, TicketCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountPageHeader } from "./account-page-header";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/components/feature-flags";
import { useWallet } from "../use-coupons";
import { markSeen } from "../use-new-badge";
import {
  describeRedemption,
  sortForTab,
  type CouponStatus,
  type WalletCoupon,
} from "./coupons";
import {
  CouponTerms,
  CouponTicket,
  CouponTicketSkeleton,
  couponLabel,
} from "./coupon-ticket";

/** `short` fits a phone's third of the row on one line; `label` is for sm+. */
const TABS: { value: CouponStatus; label: string; short: string }[] = [
  { value: "active", label: "Идэвхтэй", short: "Идэвхтэй" },
  { value: "used", label: "Ашиглагдсан", short: "Ашиглагдсан" },
  { value: "expired", label: "Хугацаа дууссан", short: "Дууссан" },
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
  const wheelOn = useFeatureFlag("lucky_wheel");

  // Visiting the page is what retires the «Шинэ» badge in the menus.
  React.useEffect(() => markSeen("coupons"), []);

  const coupons = React.useMemo(() => data ?? [], [data]);
  const count = (s: CouponStatus) =>
    coupons.filter((c) => c.status === s).length;
  const rows = React.useMemo(() => sortForTab(coupons, tab), [coupons, tab]);

  return (
    <div className="space-y-5">
      <AccountPageHeader title="Миний купон" />

      <SegmentedTabs
        label="Купоны төлөв"
        tabs={TABS.map((t) => ({ ...t, count: count(t.value) }))}
        value={tab}
        onChange={setTab}
      />

      {/* Жагсаалтын ДЭЭР — купон олон үед доор нь харагдахгүй байсан (task
          14). Купонгүй үед EmptyState хангалттай. */}
      {coupons.length > 0 && <CouponRules />}

      {isPending ? (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6"
          aria-hidden
        >
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className={cn(i > 2 && "hidden sm:block")}>
              <CouponTicketSkeleton />
            </li>
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
            tab === "active" && wheelOn ? (
              <Button asChild>
                <Link href="/lucky-wheel">Азын хүрд эргүүлэх</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        // `grid-cols-1` = minmax(0,1fr): тасалбарын `truncate` мөр (хугацаа,
        // нөхцөл) нь `nowrap` тул загваргүй багана утсан дээр тэдгээрийн
        // бүтэн урт хүртэл сунаж тасалбарыг дэлгэцээс гаргадаг (checkout-ийн
        // хүлээн авагчийн хэсэгт гарсантай ижил алдаа).
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
          {rows.map((c) => (
            <li key={c.id}>
              <CouponRow coupon={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RULES = [
  { icon: TicketCheck, text: "Нэг захиалгад нэг купон ашиглана." },
  {
    icon: Share2,
    text: "Купоноо бусдад дамжуулж ашиглуулж болно — хувийн купон ч гэсэн кодыг нь мэдэж байгаа хэн ч ашиглах боломжтой.",
  },
] as const;

/** Купоны хоёр дүрэм — бүх таб дээр, жагсаалтын дээр (task 14). */
function CouponRules() {
  return (
    <ul
      aria-label="Купоны дүрэм"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6"
    >
      {RULES.map(({ icon: Icon, text }) => (
        <li
          key={text}
          className="bg-secondary text-secondary-foreground flex items-start gap-3 rounded-xl p-4"
        >
          <span className="bg-cta text-cta-foreground grid size-9 shrink-0 place-items-center rounded-full">
            <Icon className="size-4.5" aria-hidden />
          </span>
          <p className="self-center text-sm/relaxed font-medium sm:text-base/relaxed">
            {text}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** One coupon in the wallet — the whole ticket opens its detail. */
export function CouponRow({ coupon: c }: { coupon: WalletCoupon }) {
  const last = c.redemptions[0];

  return (
    <article className="relative transition-transform duration-300 hover:-translate-y-0.5">
      <CouponTicket
        type={c.type}
        value={c.value}
        code={c.code}
        muted={c.status !== "active"}
      >
        <CouponTerms
          type={c.type}
          endsAt={c.endsAt}
          minSubtotal={c.minSubtotal}
          maxDiscount={c.maxDiscount}
          ended={c.status !== "active"}
        />
        {c.status === "used" && last && (
          <p className="text-foreground/80 mt-0.5 truncate">
            <span className="text-muted-foreground">Ашигласан: </span>
            {describeRedemption(last)}
            <span className="text-muted-foreground">
              {" "}
              · {formatDate(last.at)}
            </span>
          </p>
        )}
      </CouponTicket>
      <Link
        href={`/account/coupons/${encodeURIComponent(c.code)}`}
        aria-label={`${couponLabel(c.type, c.value)} купоны дэлгэрэнгүй`}
        className="absolute inset-0 rounded-xl"
      />
    </article>
  );
}
