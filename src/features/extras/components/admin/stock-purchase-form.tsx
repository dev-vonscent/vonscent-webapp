"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { DatePicker } from "@/features/admin/components/date-picker";
import { adminFetch } from "@/features/admin/lib/mutate";
import { formatPrice } from "@/lib/format";
import { ubToday } from "@/lib/time";
import { toast } from "@/lib/toast";
import { purchaseDateBounds, purchaseDateError } from "@/lib/validators/extras";

export interface StockCurrent {
  /** Сав тоолж эхлээгүй бол null. */
  onHand: number | null;
  reserved: number;
  updatedAt: string;
}

const digits = (v: string) => Number(v.replace(/[\s,]/g, ""));

/**
 * «Нөөц нөхөх» — худалдан авалт (plan §18.4, 0153): +ширхэг, нэгж авсан үнэ,
 * авсан өдөр. Нийт дүн тайланд тухайн өдрийн зарлага болно. Энгийн бараа ба
 * сав хоёулаа энийг ашиглана; ялгаа нь endpoint ба id-ийн түлхүүр.
 */
export function StockPurchaseForm({
  endpoint,
  target,
  current,
  onSaved,
  onConflict,
  costless = false,
}: {
  endpoint: string;
  /** `{ variantId }` эсвэл `{ vialId }`. */
  target: Record<string, string>;
  current: StockCurrent;
  onSaved: (next: StockCurrent) => void;
  /** Энэ хооронд тоо өөрчлөгдсөн — серверийн шинэ тоо. */
  onConflict: (next: StockCurrent) => void;
  /**
   * Хоосон шил: үнэртэн нь зарагдсан шил тул өртөггүй — зөвхөн ширхэг;
   * 0₮, өнөөдрөөр бичигдэнэ (тайланд зарлага 0).
   */
  costless?: boolean;
}) {
  const [qty, setQty] = React.useState("");
  const [unitCost, setUnitCost] = React.useState(costless ? "0" : "");
  const [day, setDay] = React.useState(() => ubToday());
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const q = digits(qty);
  const c = digits(unitCost);
  const qtyOk = qty.trim() !== "" && Number.isInteger(q) && q >= 1;
  const costOk = unitCost.trim() !== "" && Number.isInteger(c) && c >= 0;

  async function submit() {
    const found: Record<string, string> = {};
    if (!qtyOk) found.qty = "Ширхэг оруулна уу";
    if (!costOk) found.unitCost = "Нэгж авсан үнэ оруулна уу (үнэгүй бол 0)";
    const dateErr = day ? purchaseDateError(day) : "Авсан өдрөө сонгоно уу";
    if (dateErr) found.day = dateErr;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const res = await adminFetch<{ current: StockCurrent }>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...target,
        qty: q,
        unitCost: c,
        purchasedOn: day,
        expectedUpdatedAt: current.updatedAt,
        note,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.data?.current) onConflict(res.data.current);
      setErrors({ form: res.error });
      return;
    }
    setQty("");
    setUnitCost(costless ? "0" : "");
    setNote("");
    setErrors({});
    toast.success(`${q} ширхэг нэмэгдлээ`);
    onSaved(res.data.current);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <div className={costless ? "grid gap-3" : "grid grid-cols-2 gap-3"}>
        <Field label="Нэмэх ширхэг" error={errors.qty}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={qty}
            placeholder="100"
            className="tabular-nums"
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        {!costless && (
          <Field label="Нэгж авсан үнэ (₮)" error={errors.unitCost}>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={unitCost}
              className="tabular-nums"
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </Field>
        )}
      </div>
      {costless ? (
        <p className="text-muted-foreground text-xs">
          Үнэртэн нь зарагдсан шил тул өртөггүй — авсан үнэ, өдөр асуухгүй.
        </p>
      ) : (
        <Field
          label="Авсан өдөр"
          hint="Өмнөх сарын тайлан хаагдсан тул сонгох боломжгүй."
          error={errors.day}
        >
          <DatePicker
            value={day}
            onChange={setDay}
            clearable={false}
            {...purchaseDateBounds()}
          />
        </Field>
      )}
      <Field
        label="Тэмдэглэл"
        hint={
          costless ? "Ж: Декант нь дууссан шил" : "Ж: Нийлүүлэгч, ачааны дугаар"
        }
      >
        <Input
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <dl
        className={
          costless
            ? "bg-muted/40 rounded-md px-3 py-2 text-sm"
            : "bg-muted/40 grid grid-cols-2 gap-2 rounded-md px-3 py-2 text-sm"
        }
      >
        {!costless && (
          <div>
            <dt className="text-muted-foreground text-xs">Нийт авсан үнэ</dt>
            <dd className="font-medium tabular-nums">
              {qtyOk && costOk ? formatPrice(q * c) : "—"}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground text-xs">Нөөц болно</dt>
          <dd className="tabular-nums">
            {(current.onHand ?? 0) + (qtyOk ? q : 0)}
          </dd>
        </div>
      </dl>
      {errors.form && (
        <p role="alert" className="text-destructive text-sm">
          {errors.form}
        </p>
      )}
      <LoadingButton type="submit" loading={busy} className="w-full">
        Нөөц нөхөх
      </LoadingButton>
    </form>
  );
}
