import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrdersTable } from "@/features/admin/components/orders-table";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/db/types";

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
  }>;
}) {
  const { status, q, from, to } = await searchParams;
  const supabase = await createClient();
  let orders: OrderRow[] = [];
  if (supabase) {
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
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
    const { data } = await query;
    orders = (data as OrderRow[] | null) ?? [];
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Захиалга</h1>

      {/* Status filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="Бүгд" href="/admin/orders" active={!status} />
        {ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={ORDER_STATUS_LABEL[s]}
            href={`/admin/orders?status=${s}`}
            active={status === s}
          />
        ))}
      </div>

      {/* Search + date/time range (A1: "өдөр цагаар, дугаараар, утсаар") */}
      <form
        action="/admin/orders"
        className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-3"
      >
        {status && <input type="hidden" name="status" value={status} />}
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Хайлт
          <input
            name="q"
            defaultValue={q}
            placeholder="Дугаар / нэр / утас"
            className="border-border text-foreground focus:border-primary h-9 w-56 rounded-md border bg-transparent px-3 text-sm outline-none"
          />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Эхлэх (огноо, цаг)
          <input
            type="datetime-local"
            name="from"
            defaultValue={from}
            className="border-border text-foreground focus:border-primary h-9 rounded-md border bg-transparent px-3 text-sm outline-none"
          />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Дуусах (огноо, цаг)
          <input
            type="datetime-local"
            name="to"
            defaultValue={to}
            className="border-border text-foreground focus:border-primary h-9 rounded-md border bg-transparent px-3 text-sm outline-none"
          />
        </label>
        <button
          type="submit"
          className="bg-foreground text-background h-9 rounded-md px-4 text-sm font-medium"
        >
          Шүүх
        </button>
        {(q || from || to) && (
          <Link
            href={status ? `/admin/orders?status=${status}` : "/admin/orders"}
            className="text-muted-foreground hover:text-foreground h-9 rounded-md px-3 text-sm leading-9"
          >
            Цэвэрлэх
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <ShoppingCart className="text-muted-foreground size-10" />
          <p className="font-medium">Захиалга алга</p>
        </div>
      ) : (
        <OrdersTable data={orders} />
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
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-gold-strong",
      )}
    >
      {label}
    </Link>
  );
}
