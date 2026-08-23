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
    <DataTable columns={columns} data={data} emptyText="Хэрэглэгч алга" />
  );
}
