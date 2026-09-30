"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem } from "@/features/cart/store";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { REFUND_FEE_PCT } from "@/lib/constants";
import { requestCancel } from "@/features/account/cancel-order";
import { useRefreshAndWait } from "@/features/account/use-refresh-and-wait";
import { RefundCancelDialog } from "@/features/account/components/refund-cancel-dialog";

export type ReorderItem = Omit<CartItem, "key" | "qty"> & { qty: number };

export function OrderActions({
  orderId,
  items,
  cancellable,
  paid,
  total,
}: {
  orderId: string;
  items: ReorderItem[];
  cancellable: boolean;
  /**
   * Төлбөр орсон эсэх. Төлсөн захиалгыг цуцлахад мөнгө буцаагдах бөгөөд
   * банкны шимтгэл хасагдана — цуцлахаас ӨМНӨ хэлж, буцаалтын дансыг
   * `RefundCancelDialog`-оор авна (клиент, 2026-09-30). Төлөөгүй бол буцаах
   * мөнгө байхгүй — энгийн баталгаажуулалт.
   */
  paid: boolean;
  /** Захиалгын нийт дүн — буцаах дүнг харуулахад. */
  total: number;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [confirm, confirmDialog] = useConfirm();
  const refresh = useRefreshAndWait();
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reorder() {
    for (const { qty, ...item } of items) {
      add(item, qty);
    }
    router.push("/cart");
  }

  async function cancel() {
    setError(null);
    if (paid) {
      setRefundOpen(true);
      return;
    }
    await confirm({
      title: "Энэ захиалгыг цуцлах уу?",
      description:
        "Цуцалсан захиалгыг сэргээх боломжгүй — шинээр захиалга үүсгэх шаардлагатай.",
      confirmLabel: "Захиалга цуцлах",
      cancelLabel: "Буцах",
      destructive: true,
      // Цуцлах хүсэлт + шинэ төлөв дэлгэцэнд буух хүртэл цонх loader-тэй
      // нээлттэй — урьд нь цонх шууд хаагдаад төлөв удаж солигддог байв.
      action: runCancel,
    });
  }

  async function runCancel() {
    const result = await requestCancel(orderId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-3">
      {confirmDialog}
      {paid && (
        <RefundCancelDialog
          orderId={orderId}
          total={total}
          open={refundOpen}
          onOpenChange={setRefundOpen}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={reorder}>
          <RotateCcw className="size-4" /> Дахин захиалах
        </Button>
        {cancellable && (
          <Button variant="ghost" onClick={cancel}>
            <XCircle className="size-4" /> Цуцлах
          </Button>
        )}
      </div>
      {/* Товч дарахаас өмнө ч харагдана — баталгаажуулах цонхонд анх удаа
          сонсох нь «нуусан нөхцөл» мэт санагдана. */}
      {cancellable && paid && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Цуцалбал төлсөн дүнгээс банкны {REFUND_FEE_PCT}%-ийн шимтгэлийг хасаж
          буцаана.
        </p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
