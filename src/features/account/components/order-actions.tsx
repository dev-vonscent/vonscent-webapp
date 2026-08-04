"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type CartItem } from "@/features/cart/store";
import { useConfirm } from "@/components/shared/confirm-dialog";

export type ReorderItem = Omit<CartItem, "key" | "qty"> & { qty: number };

export function OrderActions({
  orderId,
  items,
  cancellable,
}: {
  orderId: string;
  items: ReorderItem[];
  cancellable: boolean;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reorder() {
    for (const { qty, ...item } of items) {
      add(item, qty);
    }
    router.push("/cart");
  }

  async function cancel() {
    const ok = await confirm({
      title: "Энэ захиалгыг цуцлах уу?",
      description:
        "Цуцалсан захиалгыг сэргээх боломжгүй — шинээр захиалга үүсгэх шаардлагатай.",
      confirmLabel: "Захиалга цуцлах",
      cancelLabel: "Буцах",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(
        data.error === "PAST_CUTOFF"
          ? "10:00 цаг өнгөрсөн тул захиалга цуцлах боломжгүй. Пэйж чат эсвэл утсаар холбогдоно уу."
          : "Цуцлах үед алдаа гарлаа. Дахин оролдоно уу.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {confirmDialog}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={reorder}>
          <RotateCcw className="size-4" /> Дахин захиалах
        </Button>
        {cancellable && (
          <Button variant="ghost" onClick={cancel} disabled={busy}>
            <XCircle className="size-4" /> Цуцлах
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
