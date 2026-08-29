"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@/db/types";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { adminFetch } from "@/features/admin/lib/mutate";

export function CustomerControl({
  customerId,
  role,
  loyaltyPoints,
  isBlocked,
}: {
  customerId: string;
  role: UserRole;
  loyaltyPoints: number;
  isBlocked: boolean;
}) {
  const router = useRouter();
  const [newRole, setNewRole] = React.useState<UserRole>(role);
  const [points, setPoints] = React.useState(String(loyaltyPoints));
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  async function patch(payload: Record<string, unknown>, successText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(successText);
        router.refresh();
      } else {
        setMsg(
          res.error.includes("FORBIDDEN_ROLE")
            ? "Эрх өөрчлөхөд super admin шаардлагатай."
            : res.error,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * Writing V point overwrites the customer's whole balance from a bare number
   * field — the only irreversible action on this screen, and it was the one
   * without a confirmation while blocking (recoverable) had one. The dialog
   * states the delta, because "8,400" on its own tells nobody whether they are
   * about to add points or wipe them.
   */
  async function savePoints() {
    const next = Math.max(0, Math.round(Number(points) || 0));
    if (next === loyaltyPoints) return;
    const delta = next - loyaltyPoints;
    const ok = await confirm({
      title: "V point-ийг дарж бичих үү?",
      description: `Одоогийн ${loyaltyPoints.toLocaleString("mn-MN")} оноог ${next.toLocaleString("mn-MN")} болгож солино (${delta > 0 ? "+" : ""}${delta.toLocaleString("mn-MN")}). Энэ нь нэмэх биш, бүтэн үлдэгдлийг солих үйлдэл — буцаах боломжгүй.`,
      confirmLabel: "Дарж бичих",
      destructive: true,
    });
    if (!ok) return;
    await patch(
      { loyaltyPoints: next },
      `V point ${next.toLocaleString("mn-MN")} боллоо.`,
    );
  }

  async function toggleBlock() {
    if (!isBlocked) {
      const ok = await confirm({
        title: "Хэрэглэгчийг хориглох уу?",
        description:
          "Хориглосон хэрэглэгч нэвтэрч, захиалга өгөх боломжгүй болно. Дараа нь буцааж нээж болно.",
        confirmLabel: "Хориглох",
        destructive: true,
      });
      if (!ok) return;
    }
    await patch(
      { isBlocked: !isBlocked },
      isBlocked ? "Блокоос гарлаа." : "Хэрэглэгч хоригдлоо.",
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <Field label="Эрх">
        <div className="flex gap-2">
          <Select
            value={newRole}
            onValueChange={(v) => setNewRole(v as UserRole)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={busy || newRole === role}
            onClick={() =>
              patch({ role: newRole }, `Эрх «${ROLE_LABEL[newRole]}» боллоо.`)
            }
          >
            Хадгалах
          </Button>
        </div>
      </Field>

      <Field
        label="V point"
        hint="Оруулсан тоо нь шинэ бүтэн үлдэгдэл болно (нэмэгдэхгүй)."
      >
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={busy || Math.round(Number(points) || 0) === loyaltyPoints}
            onClick={savePoints}
          >
            Хадгалах
          </Button>
        </div>
      </Field>

      <Button
        variant={isBlocked ? "secondary" : "destructive"}
        className="w-full"
        disabled={busy}
        onClick={toggleBlock}
      >
        {isBlocked ? "Блокоос гаргах" : "Хориглох"}
      </Button>

      {msg && (
        <p role="alert" className="text-destructive text-sm">
          {msg}
        </p>
      )}
    </div>
  );
}
