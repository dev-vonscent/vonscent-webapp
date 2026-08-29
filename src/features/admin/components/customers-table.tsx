"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@/db/types";

export interface CustomerListRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  loyalty_points: number;
  is_blocked: boolean;
}

const columns: ColumnDef<CustomerListRow, unknown>[] = [
  {
    accessorKey: "full_name",
    header: "Нэр",
    cell: ({ row }) => (
      <Link
        href={`/admin/customers/${row.original.id}`}
        className="hover:text-gold-strong font-medium"
      >
        {row.original.full_name || "—"}
      </Link>
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
      // Same reason as the order list: rows are one server-paginated page of
      // 50, so a phone-only re-sort would reorder that slice alone and read as
      // a sort of the whole list.
      phoneSort={false}
      emptyText="Хэрэглэгч алга"
      label="Хэрэглэгчийн жагсаалт"
      renderCard={(c) => (
        <Link href={`/admin/customers/${c.id}`} className="block space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{c.full_name || "—"}</span>
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
