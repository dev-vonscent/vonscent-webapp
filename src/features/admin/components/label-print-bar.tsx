"use client";

import { Button } from "@/components/ui/button";
import { useLabelPrinter } from "@/features/admin/hooks/use-label-printer";
import {
  LabelPaperNote,
  LabelPrintButton,
  PrintResumeNotice,
  PrinterConnectButton,
  PrinterUnsupported,
} from "@/features/admin/components/label-print-controls";
import type { OrderRow } from "@/db/types";

/**
 * Захиалгын жагсаалтын дээрх шошго хэвлэх мөр (0202, `label_print`):
 * хэвлэгч холбох, сонгосон захиалгуудын «Хаяг хэвлэх» (45×60, логотой) ба
 * «Усны шошго» (40×15 хос цаас). Хоёр өөр цаас тул тусдаа товч. Хаягийн
 * шошго бүгд хэвлэгдвэл сонголт цэвэрлэгдэнэ.
 */
export function LabelPrintBar({
  orders,
  printableCount,
  onSelectAll,
  onClear,
}: {
  orders: OrderRow[];
  printableCount: number;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const p = useLabelPrinter({
    onPrinted: (kind) => {
      if (kind === "address") onClear();
    },
  });

  if (!p.supported) {
    return (
      <div className="bg-card rounded-lg p-3">
        <PrinterUnsupported />
      </div>
    );
  }

  const allSelected = orders.length === printableCount;
  return (
    <div className="bg-card space-y-2 rounded-lg p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PrinterConnectButton p={p} />

        {printableCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onClear : onSelectAll}
            disabled={p.busy !== null}
          >
            {allSelected
              ? "Сонголт цуцлах"
              : `Баталгаажсан бүгдийг сонгох (${printableCount})`}
          </Button>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {(["perfume", "address"] as const).map((kind) => (
            <LabelPrintButton
              key={kind}
              p={p}
              kind={kind}
              count={orders.length}
              disabled={orders.length === 0}
              onPrint={() => void p.print(kind, orders)}
            />
          ))}
        </div>
      </div>
      <PrintResumeNotice p={p} />
      <LabelPaperNote />
    </div>
  );
}
