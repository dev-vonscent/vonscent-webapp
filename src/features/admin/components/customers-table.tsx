"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { ROLE_LABEL, type UserTierKey } from "@/lib/constants";
import type { UserRole } from "@/db/types";
import { TierBadge } from "@/features/tiers/components/tier-frame";

export interface CustomerListRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  loyalty_points: number;
  is_blocked: boolean;
  /** Хэрэглэгчийн түвшин (feature flag `user_tiers`); хаалттай бол null. */
  tier?: UserTierKey | null;
}

const columns: ColumnDef<CustomerListRow, unknown>[] = [
  {
    accessorKey: "full_name",
    header: "Нэр",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2">
        <Link
          href={`/admin/customers/${row.original.id}`}
          className="hover:text-gold-strong font-medium"
        >
          {row.original.full_name || "—"}
        </Link>
        {row.original.tier && <TierBadge tier={row.original.tier} />}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Утас",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">
        {getValue<string | null>() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "role",
    header: "Эрх",
    enableSorting: false,
    cell: ({ getValue }) => (
      <Badge variant="secondary">
        {ROLE_LABEL[getValue<string>() as UserRole]}
      </Badge>
    ),
  },
  {
    accessorKey: "loyalty_points",
    header: "V point",
  },
  {
    accessorKey: "is_blocked",
    header: "Төлөв",
    enableSorting: false,
    cell: ({ getValue }) =>
      getValue<boolean>() ? (
        <Badge variant="sale">Хориглосон</Badge>
      ) : (
        <Badge variant="new">Идэвхтэй</Badge>
      ),
  },
];

export function CustomersTable({ data }: { data: CustomerListRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={0}
      // Нэр дээр дарах нь хэтэрхий жижиг бай — «—» нэргүй хэрэглэгчийн хувьд
      // бараг байхгүй. Мөр бүхэлдээ дэлгэрэнгүй руу оруулна (карт аль хэдийн
      // тэгж ажилладаг байсан).
      rowHref={(c) => `/admin/customers/${c.id}`}
      // Same reason as the order list: rows are one server-paginated page of
      // 50, so a phone-only re-sort would reorder that slice alone and read as
      // a sort of the whole list.
      phoneSort={false}
      emptyText="Хэрэглэгч алга"
      label="Хэрэглэгчийн жагсаалт"
      renderCard={(c) => (
        <Link href={`/admin/customers/${c.id}`} className="block space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{c.full_name || "—"}</span>
              {c.tier && <TierBadge tier={c.tier} className="shrink-0" />}
            </span>
            {c.is_blocked ? (
              <Badge variant="sale">Хориглосон</Badge>
            ) : (
              <Badge variant="new">Идэвхтэй</Badge>
            )}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{c.phone || "Утас алга"}</span>
            <span>{ROLE_LABEL[c.role as UserRole]}</span>
            <span>{c.loyalty_points} V point</span>
          </div>
        </Link>
      )}
    />
  );
}
