"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { RestockControl } from "@/features/admin/components/restock-control";

export interface InventoryListRow {
  productId: string;
  label: string;
  onHand: number;
  reserved: number;
  lowStock: number;
  soldOut: boolean;
}

const columns: ColumnDef<InventoryListRow, unknown>[] = [
  {
    accessorKey: "label",
    header: "Бараа",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "onHand",
    header: "On hand",
    cell: ({ getValue }) => `${getValue<number>()}ml`,
  },
  {
    accessorKey: "reserved",
    header: "Reserved",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<number>()}ml</span>
    ),
  },
  {
    id: "available",
    header: "Available",
    accessorFn: (r) => r.onHand - r.reserved,
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<number>()}ml</span>
    ),
  },
  {
    id: "status",
    header: "Төлөв",
    enableSorting: false,
    cell: ({ row }) => {
      const r = row.original;
      const available = r.onHand - r.reserved;
      return r.soldOut || available <= 0 ? (
        <Badge variant="sale">Дууссан</Badge>
      ) : available <= r.lowStock ? (
        <Badge variant="secondary">Бага</Badge>
      ) : (
        <Badge variant="new">Хэвийн</Badge>
      );
    },
  },
  {
    id: "restock",
    header: "Нөхөх",
    enableSorting: false,
    cell: ({ row }) => <RestockControl productId={row.original.productId} />,
  },
];

export function InventoryTable({ data }: { data: InventoryListRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Бараагаар хайх"
      emptyText="Үлдэгдэл алга"
    />
  );
}
