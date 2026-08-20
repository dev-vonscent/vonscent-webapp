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

export function OrderStatusControl({
  orderId,
  current,
  paymentStatus,
}: {
  orderId: string;
  current: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<OrderStatus>(current);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as OrderStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Тэмдэглэл (заавал биш)"
        />
        <Button
          className="w-full"
          disabled={busy || status === current}
          onClick={() => post({ status, note })}
        >
          Төлөв шинэчлэх
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {paymentStatus !== "paid" && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => post({ paid: true })}
          >
            Төлсөн гэж тэмдэглэх
          </Button>
        )}
        {paymentStatus === "paid" && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => post({ refund: true })}
          >
            Буцаалт хийх
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
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
