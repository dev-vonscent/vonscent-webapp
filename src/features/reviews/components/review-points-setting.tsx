"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { saveSetting } from "@/features/admin/lib/mutate";
import { reviewPointsOf } from "@/lib/loyalty";
import { toast } from "@/lib/toast";

/**
 * Сэтгэгдэл батлагдахад олгох оноо — `settings.loyalty.reviewPoints` (0121).
 * V point хуудасны ижил талбартай нэг утга; `loyalty` мөрийн бусад талбарыг
 * хэвээр үлдээж зөвхөн үүнийг солино.
 */
export function ReviewPointsSetting({ loyalty }: { loyalty: unknown }) {
  const router = useRouter();
  const [points, setPoints] = React.useState(() => reviewPointsOf(loyalty));
  const [busy, setBusy] = React.useState(false);
  const saved = reviewPointsOf(loyalty);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const base =
        loyalty && typeof loyalty === "object"
          ? (loyalty as Record<string, unknown>)
          : {};
      const ok = await saveSetting(
        "loyalty",
        { ...base, reviewPoints: points },
        "Сэтгэгдлийн оноо хадгалагдсангүй",
      );
      if (ok) {
        toast.success("Сэтгэгдлийн оноо хадгалагдлаа.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="bg-card flex flex-wrap items-end gap-3 rounded-lg p-3"
    >
      <div className="space-y-1">
        <Label htmlFor="review-points" className="text-xs">
          Сэтгэгдэл бүрт олгох V point
        </Label>
        <Input
          id="review-points"
          type="number"
          min={0}
          step={1}
          value={points}
          onChange={(e) =>
            setPoints(Math.max(Math.floor(Number(e.target.value) || 0), 0))
          }
          className="w-32"
        />
      </div>
      <LoadingButton loading={busy} type="submit" disabled={points === saved}>
        Хадгалах
      </LoadingButton>
      <p className="text-muted-foreground basis-full text-xs">
        Батлах үед олгогдоно (ус бүрт нэг удаа). 0 бол урамшуулалгүй.
      </p>
    </form>
  );
}
