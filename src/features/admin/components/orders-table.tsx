"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { formatPrice, formatDateTime } from "@/lib/format";
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
        {formatDateTime(getValue<string>())}
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
    // Money reads as a column only when the digits line up.
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="font-medium tabular-nums">
        {formatPrice(getValue<number>())}
      </span>
    ),
  },
  {
    accessorKey: "payment_status",
    header: "Төлбөр",
    cell: ({ getValue }) => <PaymentBadge status={getValue<string>()} />,
  },
  {
    accessorKey: "status",
    header: "Төлөв",
    cell: ({ row }) => (
      <Badge variant="secondary">
        {ORDER_STATUS_LABEL[row.original.status]}
      </Badge>
    ),
  },
];

function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "paid" ? "new" : "secondary"}>
      {status === "paid"
        ? "Төлсөн"
        : status === "refunded"
          ? "Буцаагдсан"
          : "Төлөөгүй"}
    </Badge>
  );
}

export function OrdersTable({ data }: { data: OrderRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={0}
      // Rows arrive already ordered newest-first from the server and are one
      // page of 50 out of many, so a phone-only re-sort would reorder a slice
      // and quietly disagree with the pager beneath it.
      phoneSort={false}
      emptyText="Захиалга алга"
      label="Захиалгын жагсаалт"
      renderCard={(o) => (
        <Link href={`/admin/orders/${o.id}`} className="block space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-medium">{o.order_no}</span>
            <span className="font-medium">{formatPrice(o.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{o.contact_name}</span>
            <span className="text-muted-foreground">
              {formatDateTime(o.created_at)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{ORDER_STATUS_LABEL[o.status]}</Badge>
            <PaymentBadge status={o.payment_status} />
          </div>
        </Link>
      )}
    />
  );
}
