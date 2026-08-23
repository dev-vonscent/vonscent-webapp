"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/features/admin/components/data-table";
import { ProductImageCell } from "@/features/admin/components/product-image-cell";
import type { AdminProduct } from "@/features/admin/api";
import { formatPrice } from "@/lib/format";
import { GENDER_LABEL, type Gender } from "@/lib/constants";

const columns: ColumnDef<AdminProduct, unknown>[] = [
  {
    id: "image",
    header: "Зураг",
    enableSorting: false,
    cell: ({ row }) => {
      const p = row.original;
      return (
        <ProductImageCell
          product={{
            id: p.id,
            name: p.name,
            isActive: p.isActive,
            imageUrl: p.imageUrl,
            imageStatus: p.imageStatus,
            imageResultUrl: p.imageResultUrl,
            imageGenId: p.imageGenId,
            imagePrompt: p.imagePrompt,
            imageError: p.imageError,
          }}
        />
      );
    },
  },
  {
    accessorKey: "name",
    header: "Нэр",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "brand",
    header: "Брэнд",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "gender",
    header: "Хүйс",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">
        {GENDER_LABEL[getValue<string>() as Gender]}
      </span>
    ),
  },
  {
    accessorKey: "startingPrice",
    header: "Эхлэх үнэ",
    cell: ({ getValue }) => formatPrice(getValue<number>()),
  },
  {
    accessorKey: "availableMl",
    header: "Үлдэгдэл",
    cell: ({ getValue }) => `${getValue<number>()}ml`,
  },
  {
    id: "status",
    header: "Төлөв",
    enableSorting: false,
    cell: ({ row }) => {
      const p = row.original;
      return !p.isActive ? (
        <Badge variant="secondary">Нуусан</Badge>
      ) : p.availableMl <= 0 ? (
        <Badge variant="sale">Дууссан</Badge>
      ) : p.availableMl <= p.lowStockMl ? (
        <Badge variant="secondary">Бага</Badge>
      ) : (
        <Badge variant="new">Идэвхтэй</Badge>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="text-right">
        <Link
          href={`/admin/products/${row.original.id}/edit`}
          className="text-gold-strong inline-flex items-center gap-1 hover:underline"
        >
          <Pencil className="size-3.5" /> Засах
        </Link>
      </div>
    ),
  },
];

export function ProductsTable({ data }: { data: AdminProduct[] }) {
  return <DataTable columns={columns} data={data} emptyText="Бараа алга" />;
}
