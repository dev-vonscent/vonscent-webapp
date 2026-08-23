"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { formatPrice, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import type { OrderRow } from "@/db/types";

const columns: ColumnDef<OrderRow, unknown>[] = [
  {
    accessorKey: "order_no",
    header: "Дугаар",
    cell: ({ row }) => (
      <Link
        href={`/admin/orders/${row.original.id}`}
        className="hover:text-gold-strong font-mono"
      >
        {row.original.order_no}
      </Link>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Огноо",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">
        {formatDate(getValue<string>())}
      </span>
    ),
  },
  {
    accessorKey: "contact_name",
    header: "Хэрэглэгч",
  },
  {
    accessorKey: "total",
    header: "Дүн",
    cell: ({ getValue }) => (
      <span className="font-medium">{formatPrice(getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "payment_status",
    header: "Төлбөр",
    cell: ({ getValue }) => {
      const s = getValue<string>();
      return (
        <Badge variant={s === "paid" ? "new" : "secondary"}>
          {s === "paid" ? "Төлсөн" : s === "refunded" ? "Буцаагдсан" : "Төлөөгүй"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Төлөв",
    cell: ({ row }) => (
      <Badge variant="secondary">{ORDER_STATUS_LABEL[row.original.status]}</Badge>
    ),
  },
];

export function OrdersTable({ data }: { data: OrderRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={50}
      emptyText="Захиалга алга"
    />
  );
}
