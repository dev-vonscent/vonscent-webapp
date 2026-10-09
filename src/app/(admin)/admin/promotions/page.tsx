import Link from "next/link";
import { TicketPercent } from "lucide-react";
import {
  COUPONS_PER_PAGE,
  getCouponPage,
  getCouponSettings,
  getCustomerOptions,
} from "@/features/admin/api";
import {
  CouponCreateForm,
  CouponTable,
} from "@/features/admin/components/coupon-manager";
import { RewardTierSettings } from "@/features/admin/components/reward-tier-settings";
import { UrlSearchField } from "@/features/admin/components/customers-toolbar";
import { FilterChip } from "@/features/admin/components/filter-chip";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";
import {
  COUPON_STATUSES,
  COUPON_STATUS_LABEL,
  COUPON_TABS,
  COUPON_TAB_LABEL,
  parseCouponStatus,
  parseCouponTab,
  tabAllowsCreate,
} from "@/features/admin/lib/coupon-tabs";
import { readRewardTiers } from "@/features/admin/lib/reward-tiers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

const EMPTY_TEXT = {
  code: "Админы үүсгэсэн нийтийн код энд харагдана.",
  personal: "Тодорхой хэрэглэгчид өгсөн купон энд харагдана.",
  auto: "Захиалга шатлалын босгод хүрч төлбөрөө төлмөгц купон энд нэмэгдэнэ.",
  spin: "Хэрэглэгч азын хүрднээс купон хожмогц энд нэмэгдэнэ.",
} as const;

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = parseCouponTab(sp.tab);
  const status = parseCouponStatus(sp.status);
  const q = sp.q?.trim() || undefined;
  const pageIndex = Math.max(0, (Number(sp.page) || 1) - 1);

  const [{ rows, total, counts, owners }, settings, customerOptions] =
    await Promise.all([
      getCouponPage({ tab, status, q, page: pageIndex }),
      tab === "auto" ? getCouponSettings() : Promise.resolve(null),
      // Хувийн купоны эзэн хайлтаар сонгогдоно — энд зөвхөн эхний хуудас.
      tab === "personal" ? getCustomerOptions() : Promise.resolve([]),
    ]);

  // Табыг солиход шүүлт, хайлт, хуудас шинээр эхэлнэ; төлөв хэвээр.
  const hrefWith = makeHrefBuilder("/admin/promotions", {
    tab: tab === "code" ? undefined : tab,
    status: status === "active" ? undefined : status,
    q,
  });
  const tabHref = (t: string) =>
    hrefWith({
      tab: t === "code" ? undefined : t,
      q: undefined,
      page: undefined,
    });
  const statusHref = (s: string) =>
    hrefWith({ status: s === "active" ? undefined : s, page: undefined });

  return (
    <div className="space-y-6">
      <PageHeader title="Урамшуулал / Купон" />

      <nav
        aria-label="Купоны төрөл"
        className="bg-muted flex w-full gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit"
      >
        {COUPON_TABS.map((t) => {
          const active = t === tab;
          return (
            <Link
              key={t}
              href={tabHref(t)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {COUPON_TAB_LABEL[t]}
              {counts && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active ? "bg-secondary" : "bg-background/60",
                  )}
                >
                  {counts[t].toLocaleString("mn-MN")}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "auto" && (
        <RewardTierSettings initial={readRewardTiers(settings)} />
      )}

      {tabAllowsCreate(tab) && (
        <CouponCreateForm
          mode={tab === "personal" ? "personal" : "code"}
          customerOptions={customerOptions}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {COUPON_STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={COUPON_STATUS_LABEL[s]}
              href={statusHref(s)}
              active={status === s}
            />
          ))}
        </div>
        <UrlSearchField
          // Таб солиход талбар шинээр эхэлнэ.
          key={tab}
          id="coupon-search"
          label={
            tab === "code"
              ? "Купоныг кодоор хайх"
              : "Купоныг эзэмшигчийн нэр, утас эсвэл кодоор хайх"
          }
          placeholder={tab === "code" ? "Кодоор хайх…" : "Нэр, утас, код…"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          surface="card"
          icon={TicketPercent}
          title={
            q || status !== "all"
              ? "Энэ шүүлтэд тохирох купон алга"
              : "Купон алга"
          }
          description={
            q
              ? "Өөр нэр, утас эсвэл кодоор хайж үзнэ үү."
              : status !== "all"
                ? `«${COUPON_STATUS_LABEL[status]}» төлөвтэй купон алга. Бусад төлвийг шалгана уу.`
                : EMPTY_TEXT[tab]
          }
          action={
            (q || status !== "all") && (
              <Button variant="secondary" size="sm" asChild>
                <Link
                  href={hrefWith({
                    status: "all",
                    q: undefined,
                    page: undefined,
                  })}
                >
                  Бүх купоныг харах
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <CouponTable rows={rows} tab={tab} owners={owners} />
          {total !== null && (
            <ServerPager
              page={pageIndex}
              perPage={COUPONS_PER_PAGE}
              total={total}
              hrefForPage={(i) =>
                hrefWith({ page: i > 0 ? String(i + 1) : undefined })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
