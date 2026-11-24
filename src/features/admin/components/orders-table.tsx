"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toast";
import { mutateJson } from "@/features/admin/lib/mutate";
import { DataTable } from "@/features/admin/components/data-table";
import { LabelPrintBar } from "@/features/admin/components/label-print-bar";
import { LabelPrintedIcons } from "@/features/admin/components/label-print-controls";
import { useFeatureFlag } from "@/components/feature-flags";
import { formatPrice, formatDateTime } from "@/lib/format";
import { deliveryDayOf, formatDeliveryDay } from "@/lib/time";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  LABEL_PRINTABLE_ORDER_STATUSES,
  PAYMENT_STATUS_LABEL,
  PREPARABLE_ORDER_STATUSES,
  type OrderStatus,
  type PaymentStatusValue,
} from "@/lib/constants";
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
    id: "deliver_on",
    header: "Хүргэх өдөр",
    // Pre-orders (backlog E1) mean this is no longer "the day after the order
    // came in" — an operator planning tomorrow's run needs it on the list.
    accessorFn: (row) => deliveryDayOf(row),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDeliveryDay(deliveryDayOf(row.original))}
      </span>
    ),
  },
  {
    accessorKey: "contact_name",
    header: "Хэрэглэгч",
  },
  {
    accessorKey: "contact_phone",
    header: "Утас",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {getValue<string>()}
      </span>
    ),
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
    cell: ({ getValue }) => (
      <PaymentBadge status={getValue<PaymentStatusValue>()} />
    ),
  },
  {
    accessorKey: "status",
    header: "Төлөв",
    cell: ({ row }) => (
      <Badge className={ORDER_STATUS_STYLE[row.original.status]}>
        {ORDER_STATUS_LABEL[row.original.status]}
      </Badge>
    ),
  },
  {
    id: "prepared",
    header: "Бэлдсэн",
    accessorFn: (row) => Boolean(row.prepared_at),
    cell: ({ row }) => <PreparedToggle order={row.original} />,
  },
];

/**
 * Шошгоны багана (`label_print`): хэвлэсэн шошгоны дүрс — хаяг 🖨, ус 💧,
 * хоёулаа бол хоёулаа; бичиггүй (клиент, 2026-11). Эрэмбэ: хэвлэсэн тоогоор.
 */
const labelColumn: ColumnDef<OrderRow, unknown> = {
  id: "label_printed",
  header: "Шошго",
  accessorFn: (row) =>
    Number(Boolean(row.label_printed_at)) +
    Number(Boolean(row.perfume_label_printed_at)),
  cell: ({ row }) => (
    <LabelPrintedIcons
      addressAt={row.original.label_printed_at}
      perfumeAt={row.original.perfume_label_printed_at}
    />
  ),
};

function canPrintLabel(status: OrderStatus) {
  return (LABEL_PRINTABLE_ORDER_STATUSES as readonly OrderStatus[]).includes(
    status,
  );
}

function canPrepare(status: OrderStatus) {
  return (PREPARABLE_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

/**
 * The packer ticks an order off straight from the list once it is weighed and
 * bagged, so a confirmed order cannot sit unprepared unnoticed. Optimistic:
 * the box flips at once and snaps back if the write is refused.
 */
function PreparedToggle({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(Boolean(order.prepared_at));
  const [pending, setPending] = React.useState(false);
  React.useEffect(
    () => setChecked(Boolean(order.prepared_at)),
    [order.prepared_at],
  );

  const editable = canPrepare(order.status);
  // Pending/cancelled orders were never prepared; a dash reads as «not
  // applicable» rather than an unticked task.
  if (!editable && !checked) {
    return <span className="text-muted-foreground">—</span>;
  }

  async function onChange(next: boolean) {
    setChecked(next);
    setPending(true);
    const ok = await mutateJson(
      `/api/admin/orders/${order.id}/prepared`,
      "POST",
      { prepared: next },
      "Бэлдсэн төлөв солигдсонгүй",
    );
    setPending(false);
    if (!ok) {
      setChecked(!next);
      return;
    }
    toast.success(
      next
        ? `${order.order_no} захиалгыг бэлдсэн гэж тэмдэглэлээ.`
        : `${order.order_no} захиалгыг бэлдэгдээгүй болгож буцаалаа.`,
      next ? "Бэлдсэн" : "Бэлдэгдээгүй",
    );
    router.refresh();
  }

  return (
    <Checkbox
      checked={checked}
      disabled={!editable || pending}
      onCheckedChange={(v) => onChange(v === true)}
      aria-label={`${order.order_no} бэлдсэн`}
    />
  );
}

function PaymentBadge({ status }: { status: PaymentStatusValue }) {
  return (
    <Badge variant={status === "paid" ? "new" : "secondary"}>
      {PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function OrdersTable({ data }: { data: OrderRow[] }) {
  const labelPrint = useFeatureFlag("label_print");
  // Шошгонд сонгосон захиалгын id. Жагсаалт солигдоход (шүүлт, хуудас)
  // харагдахаа больсон мөрийг хасна — нүдэнд үл харагдах сонголт хэвлэгдэхгүй.
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  React.useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(data.map((o) => o.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  const printable = React.useMemo(
    () => data.filter((o) => canPrintLabel(o.status)),
    [data],
  );
  const toggle = React.useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const tableColumns = React.useMemo<ColumnDef<OrderRow, unknown>[]>(() => {
    if (!labelPrint) return columns;
    const allOn =
      printable.length > 0 && printable.every((o) => selected.has(o.id));
    const someOn = printable.some((o) => selected.has(o.id));
    const select: ColumnDef<OrderRow, unknown> = {
      id: "select",
      enableSorting: false,
      header: () => (
        <Checkbox
          checked={allOn ? true : someOn ? "indeterminate" : false}
          disabled={printable.length === 0}
          onCheckedChange={(v) =>
            setSelected(
              v === true ? new Set(printable.map((o) => o.id)) : new Set(),
            )
          }
          aria-label="Баталгаажсан бүх захиалгыг шошгонд сонгох"
        />
      ),
      cell: ({ row }) =>
        canPrintLabel(row.original.status) ? (
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={(v) => toggle(row.original.id, v === true)}
            aria-label={`${row.original.order_no} шошгонд сонгох`}
          />
        ) : null,
    };
    return [select, ...columns, labelColumn];
  }, [labelPrint, printable, selected, toggle]);

  const selectedOrders = React.useMemo(
    () => printable.filter((o) => selected.has(o.id)),
    [printable, selected],
  );

  return (
    <div className="space-y-3">
      {labelPrint && (
        <LabelPrintBar
          orders={selectedOrders}
          printableCount={printable.length}
          onSelectAll={() => setSelected(new Set(printable.map((o) => o.id)))}
          onClear={() => setSelected(new Set())}
        />
      )}
      <DataTable
        columns={tableColumns}
        data={data}
        pageSize={0}
        // Rows arrive already ordered newest-first from the server and are one
        // page of 50 out of many, so a phone-only re-sort would reorder a slice
        // and quietly disagree with the pager beneath it.
        phoneSort={false}
        emptyText="Захиалга алга"
        label="Захиалгын жагсаалт"
        renderCard={(o) => (
          <div className="space-y-3">
            <Link href={`/admin/orders/${o.id}`} className="block space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono font-medium">{o.order_no}</span>
                <span className="font-medium">{formatPrice(o.total)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {o.contact_name}
                  <span className="text-muted-foreground block text-xs">
                    {o.contact_phone}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(o.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={ORDER_STATUS_STYLE[o.status]}>
                  {ORDER_STATUS_LABEL[o.status]}
                </Badge>
                <PaymentBadge status={o.payment_status} />
              </div>
            </Link>
            {labelPrint && canPrintLabel(o.status) && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(o.id)}
                  onCheckedChange={(v) => toggle(o.id, v === true)}
                />
                Шошгонд сонгох
                {(o.label_printed_at || o.perfume_label_printed_at) && (
                  <span className="ml-auto">
                    <LabelPrintedIcons
                      addressAt={o.label_printed_at}
                      perfumeAt={o.perfume_label_printed_at}
                    />
                  </span>
                )}
              </label>
            )}
            {/* Outside the link: a tap on the box must not open the order. */}
            {(canPrepare(o.status) || o.prepared_at) && (
              <label className="flex items-center gap-2 text-sm">
                <PreparedToggle order={o} />
                Бэлдсэн
              </label>
            )}
          </div>
        )}
      />
    </div>
  );
}
