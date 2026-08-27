"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, fieldErrorClass } from "@/components/ui/form-field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { AddressFields } from "@/features/checkout/components/address-fields";

export interface AddressFormValue {
  recipient: string;
  phone: string;
  city: string;
  district: string;
  khoroo: number | null;
  detail: string;
}

const EMPTY: AddressFormValue = {
  recipient: "",
  phone: "",
  city: "",
  district: "",
  khoroo: null,
  detail: "",
};

interface Errors {
  recipient?: string;
  phone?: string;
  city?: string;
  district?: string;
  detail?: string;
}

/** Шинэ хүргэлтийн хаяг нэмэх dialog (мобайлд bottom sheet). */
export function AddressDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Валидаци давсан формыг хадгална (амжилтгүй бол throw хийж болно). */
  onSave: (form: AddressFormValue) => Promise<void>;
}) {
  const [form, setForm] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);

  const recipientRef = React.useRef<HTMLInputElement>(null);
  const phoneRef = React.useRef<HTMLInputElement>(null);
  const detailRef = React.useRef<HTMLInputElement>(null);
  const regionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open]);

  function clearError(key: keyof Errors) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function focusFirstError(next: Errors) {
    if (next.recipient) return recipientRef.current?.focus();
    if (next.phone) return phoneRef.current?.focus();
    if (next.city || next.district) {
      // Radix SelectTrigger = role="combobox"; эхнийх нь хот, дараах нь дүүрэг.
      const triggers =
        regionRef.current?.querySelectorAll<HTMLButtonElement>(
          "button[role='combobox']",
        ) ?? [];
      return triggers[next.city ? 0 : 1]?.focus();
    }
    if (next.detail) return detailRef.current?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!form.recipient.trim()) next.recipient = "Хүлээн авагчаа оруулна уу";
    if (!/^\d{8}$/u.test(form.phone)) next.phone = "8 оронтой дугаар оруулна уу";
    if (!form.city) next.city = "Хот / аймгаа сонгоно уу";
    if (!form.district) next.district = "Дүүрэг, сумаа сонгоно уу";
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
      title="Шинэ хаяг нэмэх"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="address-recipient">Хүлээн авагч</Label>
            <Input
              id="address-recipient"
              ref={recipientRef}
              value={form.recipient}
              aria-invalid={errors.recipient ? "true" : undefined}
              className={fieldErrorClass(errors.recipient)}
              onChange={(e) => {
                setForm({ ...form, recipient: e.target.value });
                clearError("recipient");
              }}
            />
            <FieldError message={errors.recipient} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address-phone">Утас</Label>
            <Input
              id="address-phone"
              ref={phoneRef}
              value={form.phone}
              inputMode="numeric"
              aria-invalid={errors.phone ? "true" : undefined}
              className={fieldErrorClass(errors.phone)}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                clearError("phone");
              }}
            />
            <FieldError message={errors.phone} />
          </div>
        </div>

        <div ref={regionRef}>
          <AddressFields
            value={{
              city: form.city,
              district: form.district,
              khoroo: form.khoroo,
            }}
            errors={{ city: errors.city, district: errors.district }}
            onChange={(next) => {
              setForm({
                ...form,
                city: next.city,
                district: next.district,
                khoroo: next.khoroo,
              });
              clearError("city");
              clearError("district");
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

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
