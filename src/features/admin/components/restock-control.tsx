"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Restock a source bottle: how many ml arrived and what they cost to buy.
 * The cost feeds the profit report (зардал = эх сав + restock-ууд).
 */
export function RestockControl({ productId }: { productId: string }) {
  const [amount, setAmount] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function restock() {
    const delta = Number(amount);
    if (!delta) return;
    setConfirming(false);
    setBusy(true);
    try {
      await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          delta,
          reason: "restock",
          cost: Math.max(0, Number(cost) || 0),
        }),
      });
      setDone(true);
      setAmount("");
      setCost("");
      setTimeout(() => setDone(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="ml"
        className="h-8 w-20"
      />
      <Input
        type="number"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        placeholder="Өртөг ₮"
        className="h-8 w-24"
        aria-label="Худалдан авсан үнэ (₮)"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => Number(amount) && setConfirming(true)}
        disabled={busy}
      >
        <Plus className="size-3.5" />
        {done ? "✓" : "Нөхөх"}
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Үлдэгдэл нөхөх үү?</DialogTitle>
          <DialogDescription>
            {Number(amount)} мл нэмж, өртөгт{" "}
            {Math.max(0, Number(cost) || 0).toLocaleString("mn-MN")} ₮
            бүртгэнэ. Энэ үйлдэл ашгийн тайланд шууд тусна.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirming(false)}
            >
              Болих
            </Button>
            <Button size="sm" onClick={restock}>
              Баталгаажуулах
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
