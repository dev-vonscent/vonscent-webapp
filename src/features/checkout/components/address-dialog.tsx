"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, fieldErrorClass } from "@/components/ui/form-field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { AddressFields } from "@/features/checkout/components/address-fields";
import { khorooRequired } from "@/lib/geo/locations";
import { KHOROO_REQUIRED_MESSAGE } from "@/lib/validators/order";

export interface AddressFormValue {
  city: string;
  district: string;
  khoroo: number | null;
  detail: string;
}

const EMPTY: AddressFormValue = {
  city: "",
  district: "",
  khoroo: null,
  detail: "",
};

interface Errors {
  city?: string;
  district?: string;
  khoroo?: string;
  detail?: string;
}

/**
 * Хүргэлтийн хаяг нэмэх / засах dialog (мобайлд bottom sheet). Хаягийн
 * дэвтэр (данс) ба checkout-ийн «Шинэ хаяг нэмэх» хоёулаа үүнийг хэрэглэнэ —
 * хаяг бөглөх туршлага хоёр газарт хоёр өөр байх шаардлагагүй.
 *
 * Хүлээн авагчийн нэр, утас энд асуухгүй: данс аль хэдийн өөрийн нэр, утастай
 * бөгөөд хаяг бүр дээр дахин бөглөх нь ижил мэдээллийг гурав дахин хуулж
 * бичих ажил болдог. Хаяг = зөвхөн газар нь.
 */
export function AddressDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  submitLabel,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Байгаа хаягийг засаж байвал түүний утга; шинээр нэмэхэд undefined. */
  initial?: AddressFormValue;
  /** Валидаци давсан формыг хадгална (амжилтгүй бол throw хийж болно). */
  onSave: (form: AddressFormValue) => Promise<void> | void;
  /** Хадгалахаас өөр үйлдэл бол товчны текст (checkout: «Хаяг хэрэглэх»). */
  submitLabel?: string;
  /** Товчнуудын дээр гарах нэмэлт хэсэг (checkout: хаягаа хадгалах чагт). */
  extra?: React.ReactNode;
}) {
  const editing = initial != null;
  const [form, setForm] = React.useState(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);

  const detailRef = React.useRef<HTMLInputElement>(null);
  const regionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY);
      setErrors({});
    }
    // `initial` нь шинэ объект байж болох тул зөвхөн нээх мөчид уншина.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function clearError(key: keyof Errors) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function focusFirstError(next: Errors) {
    if (next.city || next.district || next.khoroo) {
      // Radix SelectTrigger = role="combobox"; дараалал нь хот → дүүрэг → хороо.
      const triggers =
        regionRef.current?.querySelectorAll<HTMLButtonElement>(
          "button[role='combobox']",
        ) ?? [];
      const index = next.city ? 0 : next.district ? 1 : 2;
      return triggers[index]?.focus();
    }
    if (next.detail) return detailRef.current?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!form.city) next.city = "Хот / аймгаа сонгоно уу";
    if (!form.district) next.district = "Дүүрэг, сумаа сонгоно уу";
    // Хороо нь хорооны жагсаалттай хаягт заавал — сервер ч яг ижил дүрмээр
    // хаана (`checkoutOrderSchema`). Хот/дүүрэг сонгогдоогүй байхад асуухгүй:
    // тэр хоёрын алдаа нь энэ талбарыг утгагүй болгоно.
    if (
      form.city &&
      form.district &&
      form.khoroo == null &&
      khorooRequired(form.city, form.district)
    ) {
      next.khoroo = KHOROO_REQUIRED_MESSAGE;
    }
    if (!form.detail.trim()) next.detail = "Дэлгэрэнгүй хаягаа оруулна уу";
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      focusFirstError(next);
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Хаяг засах" : "Шинэ хаяг нэмэх"}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div ref={regionRef}>
          <AddressFields
            value={{
              city: form.city,
              district: form.district,
              khoroo: form.khoroo,
            }}
            errors={{
              city: errors.city,
              district: errors.district,
              khoroo: errors.khoroo,
            }}
            onChange={(next) => {
              setForm({
                ...form,
                city: next.city,
                district: next.district,
                khoroo: next.khoroo,
              });
              clearError("city");
              clearError("district");
              clearError("khoroo");
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address-detail">Дэлгэрэнгүй хаяг</Label>
          <Input
            id="address-detail"
            ref={detailRef}
            value={form.detail}
            placeholder="Байр, орц, тоот"
            aria-invalid={errors.detail ? "true" : undefined}
            className={fieldErrorClass(errors.detail)}
            onChange={(e) => {
              setForm({ ...form, detail: e.target.value });
              clearError("detail");
            }}
          />
          <FieldError message={errors.detail} />
        </div>

        {extra}

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Хадгалж байна…" : (submitLabel ?? "Хадгалах")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
