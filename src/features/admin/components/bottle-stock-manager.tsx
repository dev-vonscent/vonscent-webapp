"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleSlash, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { adminFetch } from "@/features/admin/lib/mutate";
import { GENDERS, GENDER_LABEL, ML_SIZES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  BottleStockCell,
  BottleOverrideRow,
} from "@/features/admin/api";

/**
 * Савны нөөц — хоосон декант савны өнгө (хүйс) × хэмжээний унтраалга (0095).
 *
 * Энэ нь БАРААНЫ хэмжээг унтраадаг тохиргоо БИШ: нэг нүд хаагдахад тэр
 * хүйсийн БҮХ бараа тэр хэмжээгээрээ зарагдахаа болино. Бараа тус бүрийн
 * гарын унтраалга (`product_variants.is_active`) хөндөгдөхгүй тул сав ирээд
 * нээхэд өмнө нь зориуд хаасан хэмжээ нээгдэхгүй.
 */
export function BottleStockManager({
  cells,
  overrides,
  migrated,
  countsReady,
}: {
  cells: BottleStockCell[];
  overrides: BottleOverrideRow[];
  migrated: boolean;
  /** Нөлөөллийн тоо бүрэн уншигдсан эсэх — үгүй бол тоо харуулахгүй. */
  countsReady: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<BottleStockCell | null>(null);
  const [note, setNote] = React.useState("");
  const [clearOverrides, setClearOverrides] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const byKey = new Map(cells.map((c) => [`${c.gender}:${c.ml}`, c]));

  function open(cell: BottleStockCell) {
    setPending(cell);
    setNote(cell.note);
    setClearOverrides(true);
  }

  async function submit() {
    if (!pending) return;
    setBusy(true);
    try {
      // `adminFetch` — цуцлагдсан чөлөөлөлтийн ТОО хэрэгтэй тул хариуны биеийг
      // уншина (`mutateJson` нь зөвхөн амжилттай эсэхийг хэлдэг).
      const res = await adminFetch<{ clearedOverrides?: number }>(
        "/api/admin/bottles",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender: pending.gender,
            ml: pending.ml,
            isActive: !pending.isActive,
            note: pending.isActive ? note : "",
            clearOverrides,
          }),
        },
      );
      if (!res.ok) {
        toast.error(
          res.error === "NOT_MIGRATED"
            ? "Сангийн шинэчлэл (0095) ажиллаагүй байна."
            : res.error,
          "Хадгалагдсангүй",
        );
        return;
      }
      const cleared = Number(res.data?.clearedOverrides ?? 0);
      toast.success(
        pending.isActive
          ? `${GENDER_LABEL[pending.gender]} ${pending.ml}ml сав хаагдлаа.`
          : cleared > 0
            ? `${GENDER_LABEL[pending.gender]} ${pending.ml}ml сав нээгдэж, ${cleared} чөлөөлөлт цуцлагдлаа.`
            : `${GENDER_LABEL[pending.gender]} ${pending.ml}ml сав нээгдлээ.`,
      );
      setPending(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!migrated) {
    return (
      <EmptyState
        title="Савны нөөц бэлэн болоогүй байна"
        description="0095_bottle_stock.sql migration ажиллуулсны дараа энэ хуудас идэвхжинэ."
      />
    );
  }

  const lockedCount = cells.filter((c) => !c.isActive).length;

  return (
    <div className="space-y-6">
      {lockedCount > 0 && (
        <p className="text-destructive text-sm">
          {lockedCount} хослолын сав дууссан гэж тэмдэглэгдсэн байна — тэдгээр
          хэмжээ дэлгүүр дээр захиалагдахгүй.
        </p>
      )}

      {/* Хүйс бүрээр нэг мөр: нүд бүр нь нэг өнгө/хэмжээний сав. */}
      <div className="space-y-4">
        {GENDERS.map((gender) => (
          <Card key={gender}>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium">
                {GENDER_LABEL[gender]} үнэрийн сав
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ML_SIZES.map((ml) => {
                  const cell = byKey.get(`${gender}:${ml}`);
                  if (!cell) return null;
                  return (
                    <button
                      key={ml}
                      type="button"
                      onClick={() => open(cell)}
                      aria-label={`${GENDER_LABEL[gender]} ${ml}ml — ${
                        cell.isActive ? "хаах" : "нээх"
                      }`}
                      className={cn(
                        "flex min-h-24 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                        cell.isActive
                          ? "border-border hover:bg-accent"
                          : "border-destructive bg-destructive/5 hover:bg-destructive/10",
                      )}
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="font-semibold">{ml}ml</span>
                        {cell.isActive ? (
                          <CircleCheck className="text-success size-4" />
                        ) : (
                          <CircleSlash className="text-destructive size-4" />
                        )}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {cell.isActive ? "Сав байгаа" : "Сав дууссан"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {countsReady
                          ? `${cell.productCount} бараа`
                          : "— бараа"}
                        {countsReady &&
                          cell.overrideCount > 0 &&
                          ` · ${cell.overrideCount} чөлөөлсөн`}
                      </span>
                      {!cell.isActive && cell.note && (
                        <span className="text-foreground/80 text-xs">
                          {cell.note}
                        </span>
                      )}
                      {cell.updatedAt && (
                        <span className="text-muted-foreground mt-auto text-[11px]">
                          {formatDateTime(cell.updatedAt)}
                          {cell.updatedByName ? ` · ${cell.updatedByName}` : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Чөлөөлсөн бараанууд — сав ирээд түгжээг нээхэд цуцлахыг санахад
          тусална. Үлдвэл ДАРААГИЙН түгжээнд чимээгүй нэвчинэ. */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Unlock className="text-muted-foreground size-4" />
            <p className="text-sm font-medium">Түгжээнээс чөлөөлсөн бараа</p>
            <Badge variant="secondary">{overrides.length}</Badge>
          </div>
          {overrides.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Одоогоор байхгүй. Барааны жагсаалтын мөрнөөс тухайн хэмжээг
              чөлөөлж, өөр өнгийн саванд цутгахыг зөвшөөрч болно.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {overrides.map((o) => (
                <li
                  key={`${o.productId}:${o.ml}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">
                    <span className="text-muted-foreground text-xs uppercase">
                      {o.brand}
                    </span>{" "}
                    {o.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {GENDER_LABEL[o.gender]} · {o.ml}ml
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={pending != null}
        onOpenChange={(v) => !v && setPending(null)}
        title={
          pending?.isActive
            ? `${GENDER_LABEL[pending.gender]} ${pending.ml}ml савыг хаах уу?`
            : pending
              ? `${GENDER_LABEL[pending.gender]} ${pending.ml}ml савыг нээх үү?`
              : ""
        }
        description={
          !pending?.isActive
            ? "Тэр хэмжээ дэлгүүр дээр дахин зарагдаж эхэлнэ."
            : countsReady
              ? `${pending.productCount} бараа тэр хэмжээгээрээ захиалагдахаа болино. Бусад хэмжээ, бусад өнгө хэвээр.`
              : // Тоо нь дутуу уншигдсан — «0 бараа хөндөгдөнө» гэж худал
                // хэлэхээс дуугүй байх нь дээр.
                "Энэ өнгөний бүх бараа тэр хэмжээгээрээ захиалагдахаа болино. Бусад хэмжээ, бусад өнгө хэвээр."
        }
      >
        <div className="space-y-4 pt-2">
          {pending?.isActive && (
            <div className="space-y-1.5">
              <label className="text-sm" htmlFor="bottle-note">
                Тэмдэглэл (заавал биш)
              </label>
              <Input
                id="bottle-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ж: 9/28-нд ирнэ"
                maxLength={200}
              />
            </div>
          )}
          {pending != null &&
            !pending.isActive &&
            countsReady &&
            pending.overrideCount > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox
                  checked={clearOverrides}
                  onCheckedChange={(v) => setClearOverrides(Boolean(v))}
                  className="mt-0.5"
                />
                <span>
                  Энэ хэмжээний {pending.overrideCount} чөлөөлөлтийг цуцлах —
                  сав ирсэн тул онцгой зөвшөөрөл хэрэггүй болно.
                </span>
              </label>
            )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPending(null)}>
              Болих
            </Button>
            <Button
              variant={pending?.isActive ? "destructive" : "default"}
              disabled={busy}
              onClick={submit}
            >
              {pending?.isActive ? (
                <>
                  <Lock className="size-4" /> Хаах
                </>
              ) : (
                <>
                  <Unlock className="size-4" /> Нээх
                </>
              )}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
