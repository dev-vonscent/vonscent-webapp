"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from "@/lib/constants";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { mutateJson } from "@/features/admin/lib/mutate";

/**
 * Which statuses may follow the current one. Without this every status was
 * reachable from every other, so «Хүргэгдсэн → Хүлээгдэж буй» and an
 * irreversible cancellation sat one click apart in the same Select.
 */
const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  // A courier who cannot deliver brings the parcel back — an ordinary day in
  // Ulaanbaatar, not an exception.
  shipping: ["delivered", "confirmed", "cancelled"],
  delivered: [],
  cancelled: [],
};

/**
 * Recovery edges, super_admin only. Making `delivered`/`cancelled` absolutely
 * terminal did not remove the cost of a mis-tap — it moved that cost to the
 * Supabase console, off the audit trail. These put it back in the UI, where
 * `order_status_history` records who did it and why.
 */
const RECOVERY_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: [],
  confirmed: [],
  shipping: [],
  delivered: ["shipping"],
  cancelled: ["pending"],
};

/** Transitions that need more than a shrug before they run. */
const GUARDED: Partial<
  Record<OrderStatus, { title: string; description: string; label: string }>
> = {
  cancelled: {
    title: "Захиалгыг цуцлах уу?",
    description:
      "Захиалагдсан мл нь үлдэгдэл рүү буцаж нээгдэнэ. Худалдан авагчид цуцлагдсан гэж харагдана.",
    label: "Цуцлах",
  },
  pending: {
    title: "Цуцалсан захиалгыг сэргээх үү?",
    description:
      "Захиалга «Хүлээгдэж буй» болж, мл дахин захиалагдана. Үлдэгдэл хүрэлцэхгүй бол сэргээхгүй.",
    label: "Сэргээх",
  },
  shipping: {
    title: "Хүргэлт рүү буцаах уу?",
    description:
      "«Хүргэгдсэн» тэмдэглэгээ буцаана. Захиалга дахин хүргэлтэд орно.",
    label: "Буцаах",
  },
};

export function OrderStatusControl({
  orderId,
  current,
  paymentStatus,
  canRecover = false,
}: {
  orderId: string;
  current: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  /** super_admin only — unlocks the recovery edges out of a terminal status. */
  canRecover?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<OrderStatus>(current);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const allowed = [
    ...NEXT_STATUSES[current],
    ...(canRecover ? RECOVERY_STATUSES[current] : []),
  ];
  const isTerminal = allowed.length === 0;
  const isRecovery = RECOVERY_STATUSES[current].includes(status);

  /**
   * A failed status change used to produce nothing at all — no refresh, no
   * message, the button simply un-busied. Every outcome now speaks.
   */
  async function post(
    payload: Record<string, unknown>,
    successText: string,
    errorTitle: string,
  ) {
    setBusy(true);
    try {
      const ok = await mutateJson(
        `/api/admin/orders/${orderId}/status`,
        "POST",
        payload,
        errorTitle,
      );
      if (!ok) return;
      toast.success(successText);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    const guard = GUARDED[status];
    if (guard) {
      const ok = await confirm({
        title: guard.title,
        description: guard.description,
        confirmLabel: guard.label,
        destructive: !isRecovery,
      });
      if (!ok) return;
    }
    await post(
      { status, note },
      `Төлөв «${ORDER_STATUS_LABEL[status]}» боллоо.`,
      "Төлөв солигдсонгүй",
    );
  }

  async function refund() {
    const ok = await confirm({
      title: "Буцаалт хийх үү?",
      description:
        "Захиалгын төлбөр буцаагдсан гэж тэмдэглэгдэнэ. Энэ үйлдлийг сайтаас буцаах боломжгүй.",
      confirmLabel: "Буцаалт хийх",
      destructive: true,
    });
    if (!ok) return;
    await post(
      { refund: true },
      "Буцаалт бүртгэгдлээ.",
      "Буцаалт бүртгэгдсэнгүй",
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="space-y-2">
        {isTerminal ? (
          <p className="bg-secondary text-muted-foreground rounded-md px-3 py-2 text-sm">
            Захиалга «{ORDER_STATUS_LABEL[current]}» төлөвт хүрсэн тул төлөв
            солих боломжгүй. Андуурсан бол супер админаар сэргээлгэнэ үү.
          </p>
        ) : (
          <>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as OrderStatus)}
            >
              <SelectTrigger aria-label="Захиалгын төлөв">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Current status stays selectable so the trigger can show it;
                    everything else is filtered to legal next steps. */}
                {ORDER_STATUSES.filter(
                  (s) => s === current || allowed.includes(s),
                ).map((s) => (
                  <SelectItem key={s} value={s} disabled={s === current}>
                    {ORDER_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Төлөв солих тэмдэглэл"
              placeholder="Тэмдэглэл (заавал биш)"
            />
            {status !== current && (
              <p className="text-muted-foreground text-xs">
                {ORDER_STATUS_LABEL[current]} → {ORDER_STATUS_LABEL[status]}
              </p>
            )}
            <Button
              className="w-full"
              disabled={busy || status === current}
              onClick={changeStatus}
            >
              {busy ? "Шинэчилж байна…" : "Төлөв шинэчлэх"}
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {paymentStatus !== "paid" && (
          <Button
            variant="secondary"
            className="h-11 md:h-9"
            disabled={busy}
            onClick={() =>
              post(
                { paid: true },
                "Төлсөн гэж тэмдэглэгдлээ.",
                "Тэмдэглэгдсэнгүй",
              )
            }
          >
            Төлсөн гэж тэмдэглэх
          </Button>
        )}
        {paymentStatus === "paid" && (
          <Button
            variant="secondary"
            className="h-11 md:h-9"
            disabled={busy}
            onClick={refund}
          >
            Буцаалт хийх
          </Button>
        )}
        <Button
          variant="secondary"
          className="h-11 md:h-9"
          onClick={() =>
            window.open(`/admin/orders/${orderId}/invoice`, "_blank")
          }
        >
          <Printer className="size-4" /> Нэхэмжлэх
        </Button>
      </div>
    </div>
  );
}
