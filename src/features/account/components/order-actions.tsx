"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Info, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem } from "@/features/cart/store";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { REFUND_FEE_PCT } from "@/lib/constants";
import { requestCancel } from "@/features/account/cancel-order";
import { useRefreshAndWait } from "@/features/account/use-refresh-and-wait";
import { RefundCancelDialog } from "@/features/account/components/refund-cancel-dialog";
import { requestAbandon } from "@/features/payment/abandon";
import { clearPendingOrder } from "@/features/checkout/pending-order";
import { LoadingButton } from "@/components/shared/loading-button";
import { toast } from "@/lib/toast";

export type ReorderItem = Omit<CartItem, "key" | "qty"> & { qty: number };

/**
 * Захиалгын дэлгэрэнгүйн үйлдлүүд (клиент, 2026-10):
 *   • төлбөр хүлээж буй (30 минутын дотор) — «Дараа захиалах» ба «Устгах».
 *     Төлөөгүй захиалгыг «цуцлах» гэж байхгүй: устгасан нь хаана ч
 *     үлдэхгүй (0124), дахин захиалах нь утгагүй — захиалга аль хэдийн нээлттэй;
 *   • хүргэгдсэн — «Дахин захиалах», бэлгийн мөргүйгээр (бэлэг сар бүр өөр);
 *   • төлсөн, хугацаа нь болоогүй — «Цуцлах» (буцаалтын данстай).
 */
export function OrderActions({
  orderId,
  items,
  cancellable,
  paid,
  total,
  payToken = null,
  canSaveForLater = true,
}: {
  orderId: string;
  /** Хүргэгдсэн захиалгын дахин захиалах мөрүүд (бэлэггүй). Хоосон бол товч гарахгүй. */
  items: ReorderItem[];
  cancellable: boolean;
  /**
   * Төлбөр хүлээж буй захиалгын `pay_token` — өгвөл «Дараа захиалах» /
   * «Устгах» гарна (`/api/payments/abandon`).
   */
  payToken?: string | null;
  /** Захиалгад сагсны хуулбар бий эсэх — байхгүй бол зөвхөн «Устгах». */
  canSaveForLater?: boolean;
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
  const [saving, setSaving] = React.useState(false);

  async function abandon(token: string, saveForLater: boolean) {
    setError(null);
    const result = await requestAbandon(token, saveForLater);
    if (!result.ok) {
      // Энэ хооронд төлөгдсөн бол хуудас шинэ төлөвөө харуулна.
      if (result.paid) await refresh();
      else setError(result.message);
      return;
    }
    clearPendingOrder(token);
    toast(
      saveForLater
        ? "«Дараа захиалах» хэсгээс үргэлжлүүлээрэй."
        : "Захиалга устгагдлаа.",
    );
    router.push(saveForLater ? "/account/orders?tab=saved" : "/account/orders");
  }

  async function saveForLater(token: string) {
    setSaving(true);
    try {
      await abandon(token, true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(token: string) {
    await confirm({
      title: "Захиалгыг устгах уу?",
      description:
        "Төлөгдөөгүй энэ захиалга устаж, нөөцөлсөн бараа чөлөөлөгдөнө.",
      confirmLabel: "Устгах",
      cancelLabel: "Буцах",
      destructive: true,
      action: () => abandon(token, false),
    });
  }

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
        {payToken ? (
          <>
            {canSaveForLater && (
              <LoadingButton
                variant="outline"
                loading={saving}
                onClick={() => saveForLater(payToken)}
              >
                <BookmarkPlus className="size-4" /> Дараа захиалах
              </LoadingButton>
            )}
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => remove(payToken)}
            >
              <Trash2 className="size-4" /> Устгах
            </Button>
          </>
        ) : (
          items.length > 0 && (
            <Button variant="outline" onClick={reorder}>
              <RotateCcw className="size-4" /> Дахин захиалах
            </Button>
          )
        )}
        {!payToken && cancellable && (
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
