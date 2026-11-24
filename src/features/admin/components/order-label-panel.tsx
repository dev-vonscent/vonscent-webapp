"use client";

import { Check } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import {
  LABEL_PRINTABLE_ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/constants";
import {
  useLabelPrinter,
  type LabelKind,
} from "@/features/admin/hooks/use-label-printer";
import {
  LABEL_KIND_ICON,
  LABEL_KIND_TEXT,
  LabelPaperNote,
  LabelPrintButton,
  PrintResumeNotice,
  PrinterConnectButton,
  PrinterUnsupported,
} from "@/features/admin/components/label-print-controls";
import type { OrderRow } from "@/db/types";

/**
 * Захиалгын дэлгэрэнгүй хуудасны «Шошго» хэсэг (`label_print`): хаяг ба
 * усны шошго хэвлэсэн эсэх (цагтай), хэвлэх товчнууд, «Зогсоох». Хэвлэх нь
 * зөвхөн баталгаажсан захиалгад; хэвлэсэн тэмдэглэл нь үргэлж харагдана.
 */
export function OrderLabelPanel({ order }: { order: OrderRow }) {
  const p = useLabelPrinter();
  const printable = (
    LABEL_PRINTABLE_ORDER_STATUSES as readonly OrderStatus[]
  ).includes(order.status);
  const printedAt: Record<LabelKind, string | null | undefined> = {
    address: order.label_printed_at,
    perfume: order.perfume_label_printed_at,
  };

  return (
    <div className="space-y-3">
      <h2 className="font-medium">Шошго</h2>
      <ul className="space-y-1.5 text-sm">
        {(["address", "perfume"] as const).map((kind) => {
          const Icon = LABEL_KIND_ICON[kind];
          const at = printedAt[kind];
          return (
            <li key={kind} className="flex items-center gap-2">
              <Icon className="text-muted-foreground size-4" aria-hidden />
              <span className="whitespace-nowrap">{LABEL_KIND_TEXT[kind]}</span>
              {/* Хэвлэсэн бол зөвхөн ✓ (клиент, 2026-11); цаг нь tooltip-д. */}
              {at && (
                <Check
                  className="text-success size-4"
                  aria-label={`Хэвлэсэн: ${formatDateTime(at)}`}
                >
                  <title>{`Хэвлэсэн: ${formatDateTime(at)}`}</title>
                </Check>
              )}
            </li>
          );
        })}
      </ul>

      {printable &&
        (p.supported ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(["address", "perfume"] as const).map((kind) => (
                <LabelPrintButton
                  key={kind}
                  p={p}
                  kind={kind}
                  className="flex-1"
                  onPrint={() => void p.print(kind, [order])}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <PrinterConnectButton p={p} />
            </div>
            <PrintResumeNotice p={p} />
            <LabelPaperNote />
          </div>
        ) : (
          <PrinterUnsupported />
        ))}
    </div>
  );
}
