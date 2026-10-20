"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import type { AdminExtraVariant } from "../../types";
import { StockModeToggle, type StockMode } from "./stock-mode-toggle";
import { StockPurchaseForm } from "./stock-purchase-form";

interface Current {
  onHand: number;
  reserved: number;
  updatedAt: string;
}

/**
 * Энгийн барааны нөөц (plan §7.3, §18.4): «Нөөц нөхөх» (худалдан авалт —
 * өртөг тайланд орно) ба «Тоо засах» (тооллогын залруулга, өртөггүй).
 *
 * Цонх нээгдэх үеийн `updated_at`-ийг хамт илгээнэ. Энэ хооронд захиалга
 * орж/гарч тоо өөрчлөгдсөн бол сервер хадгалахгүй, шинэ тоог буцаана —
 * админ шинэ «Захиалгад орсон»-ыг харж байж дахин хадгална.
 */
export function ExtraStockDialog({
  open,
  onOpenChange,
  title,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** «Бэлгийн хайрцаг — Хар» */
  title: string;
  variant: AdminExtraVariant;
}) {
  const router = useRouter();
  const [current, setCurrent] = React.useState<Current>({
    onHand: variant.onHand ?? 0,
    reserved: variant.reserved,
    updatedAt: variant.updatedAt,
  });
  const [value, setValue] = React.useState(String(variant.onHand ?? 0));
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<StockMode>("purchase");

  // Шинээр нээх бүрд серверийн хамгийн сүүлийн тооноос эхэлнэ.
  React.useEffect(() => {
    if (!open) return;
    setMode("purchase");
    setCurrent({
      onHand: variant.onHand ?? 0,
      reserved: variant.reserved,
      updatedAt: variant.updatedAt,
    });
    setValue(String(variant.onHand ?? 0));
    setNote("");
    setError(undefined);
  }, [open, variant]);

  const parsed = Number(value.replace(/[\s,]/g, ""));
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0;
  const available = valid ? Math.max(parsed - current.reserved, 0) : null;

  async function submit() {
    if (!valid) {
      setError("Тоо оруулна уу");
      return;
    }
    if (parsed < current.reserved) {
      setError(
        `Хүргэгдээгүй захиалгад ${current.reserved} ширхэг орсон тул түүнээс бага тоо оруулах боломжгүй.`,
      );
      return;
    }
    setBusy(true);
    const res = await adminFetch<{ current: Current }>(
      "/api/admin/extras/stock",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: variant.id,
          onHand: parsed,
          expectedUpdatedAt: current.updatedAt,
          note,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      // Зөрчил: серверийн шинэ тоог харуулаад админд дахин шийдүүлнэ.
      if (res.data?.current) setCurrent(res.data.current);
      setError(res.error);
      return;
    }
    toast.success("Нөөц хадгалагдлаа");
    onOpenChange(false);
    router.refresh();
  }

  const summary = (
    <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-md px-3 py-2 text-sm">
      <div>
        <dt className="text-muted-foreground text-xs">Нийт</dt>
        <dd className="tabular-nums">{current.onHand}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Захиалгад орсон</dt>
        <dd className="tabular-nums">{current.reserved}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Зарах боломжтой</dt>
        <dd className="font-medium tabular-nums">
          {Math.max(current.onHand - current.reserved, 0)}
        </dd>
      </div>
    </dl>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={busy ? () => {} : onOpenChange}
      title={title}
    >
      <div className="space-y-4">
        <StockModeToggle value={mode} onChange={setMode} />
        {summary}
        {mode === "purchase" ? (
          <StockPurchaseForm
            endpoint="/api/admin/extras/purchase"
            target={{ variantId: variant.id }}
            current={current}
            onConflict={(c) => setCurrent({ ...c, onHand: c.onHand ?? 0 })}
            onSaved={() => {
              onOpenChange(false);
              router.refresh();
            }}
          />
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <Field
              label="Тоолсон нийт тоо"
              hint="Тооллогоор зөрсөн үед энд засна. Хүргэгдээгүй захиалгынхыг оруулаад бичнэ. Өртөг тайланд орохгүй."
              error={error}
            >
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(undefined);
                }}
                className="tabular-nums"
              />
            </Field>
            <p className="text-muted-foreground text-xs">
              Зарах боломжтой болно:{" "}
              <span className="text-foreground font-medium tabular-nums">
                {available ?? "—"}
              </span>
            </p>
            <Field label="Тэмдэглэл" hint="Ж: Тооллогоор 2 дутсан">
              <Input
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Болих
              </Button>
              <LoadingButton type="submit" loading={busy}>
                Тоо засах
              </LoadingButton>
            </div>
          </form>
        )}
      </div>
    </ResponsiveDialog>
  );
}
