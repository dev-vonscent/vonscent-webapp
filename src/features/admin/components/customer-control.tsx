"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@/db/types";

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

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(
          data.error === "FORBIDDEN_ROLE"
            ? "Эрх өөрчлөхөд super admin шаардлагатай."
            : "Алдаа гарлаа.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Эрх</Label>
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
            onClick={() => patch({ role: newRole })}
          >
            Хадгалах
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>V point</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => patch({ loyaltyPoints: Number(points) })}
          >
            Хадгалах
          </Button>
        </div>
      </div>

      <Button
        variant={isBlocked ? "outline" : "ghost"}
        className="w-full"
        disabled={busy}
        onClick={() => patch({ isBlocked: !isBlocked })}
      >
        {isBlocked ? "Блокоос гаргах" : "Хориглох"}
      </Button>

      {msg && <p className="text-destructive text-sm">{msg}</p>}
    </div>
  );
}
