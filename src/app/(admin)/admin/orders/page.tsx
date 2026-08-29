import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrdersTable } from "@/features/admin/components/orders-table";
import { DateRangeFilter } from "@/features/admin/components/date-range-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/db/types";

/** Server-side page size; the table no longer paginates on the client. */
const ORDERS_PER_PAGE = 50;

/**
 * `datetime-local` gives us UB wall-clock text; the column is timestamptz, so
 * pin the +08:00 offset explicitly instead of letting the server's zone decide.
 */
function ubIso(local: string | undefined): string | undefined {
  if (!local) return undefined;
  const v = local.length === 16 ? `${local}:00` : local;
  return `${v}+08:00`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { status, q, from, to, page } = await searchParams;
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);
  const supabase = await createClient();
  let orders: OrderRow[] = [];
  // `null` = demo mode (no Supabase); a number is the real total, which the
  // pager needs. The old `.limit(200)` truncated silently, so past 200 orders
  // the list was simply wrong with nothing on screen saying so.
  let total: number | null = null;
  if (supabase) {
    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(
        pageIndex * ORDERS_PER_PAGE,
        pageIndex * ORDERS_PER_PAGE + ORDERS_PER_PAGE - 1,
      );
    if (status && ORDER_STATUSES.includes(status as OrderStatus)) {
      query = query.eq("status", status);
    }
    if (q) {
      // Order number, customer name or phone — the three things staff have to
      // hand when a delivery problem comes in (requirement_fb.md A1).
      const term = q.replace(/[%,()]/g, "");
      query = query.or(
        `order_no.ilike.%${term}%,contact_name.ilike.%${term}%,contact_phone.ilike.%${term}%`,
      );
    }
    const fromIso = ubIso(from);
    const toIso = ubIso(to);
    if (fromIso) query = query.gte("created_at", fromIso);
    if (toIso) query = query.lte("created_at", toIso);
    const { data, count } = await query;
    orders = (data as OrderRow[] | null) ?? [];
    total = count ?? 0;
  }

  // Paging keeps every filter; changing a filter resets to page 1.
  const hrefWith = makeHrefBuilder("/admin/orders", { status, q, from, to });
  const pageHref = (i: number) =>
    hrefWith({ page: i > 0 ? String(i + 1) : undefined });
  const statusHref = (s?: OrderStatus) =>
    hrefWith({ status: s, page: undefined });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Захиалга</h1>

      {/* Status filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Every chip carries the operator's search and date range forward —
            dropping them mid-investigation was silent data loss. */}
        <FilterChip
          label="Бүгд"
          href={statusHref(undefined)}
          active={!status}
        />
        {ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={ORDER_STATUS_LABEL[s]}
            href={statusHref(s)}
            active={status === s}
          />
        ))}
      </div>

      {/* Search + date range (A1: "өдөр цагаар, дугаараар, утсаар") */}
      {/* The surface is a card, not a border: globals.css collapses every
          border to transparent, so this filter bar used to float unframed. */}
      <div className="bg-card space-y-3 rounded-lg p-3">
        {/* Presets first: "today's orders" is the question this page is opened
            to answer, and it used to cost two typed datetimes. */}
        <DateRangeFilter from={from} to={to} params={{ status, q }} />

        <form action="/admin/orders" className="flex flex-wrap items-end gap-3">
          {status && <input type="hidden" name="status" value={status} />}
          {/* The range lives in the URL, so the search form has to carry it
              across a submit or filtering by phone would clear the dates. */}
          {from && <input type="hidden" name="from" value={from} />}
          {to && <input type="hidden" name="to" value={to} />}
          <label className="text-muted-foreground flex flex-col gap-1 text-xs">
            Хайлт
            <Input
              name="q"
              defaultValue={q}
              placeholder="Дугаар / нэр / утас"
              className="w-56"
            />
          </label>
          <Button type="submit">Хайх</Button>
          {(q || from || to) && (
            <Button variant="ghost" asChild>
              <Link
                href={
                  status ? `/admin/orders?status=${status}` : "/admin/orders"
                }
              >
                Цэвэрлэх
              </Link>
            </Button>
          )}
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg py-20 text-center">
          <ShoppingCart className="text-muted-foreground size-10" />
          <p className="font-medium">
            {status || q || from || to
              ? "Энэ шүүлтэд тохирох захиалга алга"
              : "Захиалга алга"}
          </p>
          <p className="text-muted-foreground max-w-xs text-sm">
            {status || q || from || to
              ? "Шүүлтүүрээ өөрчилж эсвэл цэвэрлээд дахин үзнэ үү."
              : "Худалдан авагч эхний захиалгаа өгмөгц энд харагдана."}
          </p>
          {(status || q || from || to) && (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/orders">Бүх захиалга харах</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <OrdersTable data={orders} />
          {total !== null && (
            <ServerPager
              page={pageIndex}
              perPage={ORDERS_PER_PAGE}
              total={total}
              hrefForPage={pageHref}
            />
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // Inactive chips had only a (transparent) border, so five of the six
        // read as bare floating words. Every chip now carries a surface.
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
