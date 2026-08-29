"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AIMAGS,
  getAimag,
  getChildren,
  getKhoroos,
  childLabel,
  formatKhoroo,
  isCapital,
} from "@/lib/geo/locations";

export interface AddressValue {
  /** Cyrillic аймаг / Улаанбаатар name — stored in orders.ship_city. */
  city: string;
  /** Cyrillic сум / дүүрэг name — stored in orders.ship_district. */
  district: string;
  /** Khoroo number; capital only, null in the countryside. */
  khoroo: number | null;
}

/**
 * Cascading Mongolian address picker: аймаг → сум/дүүрэг → хороо.
 *
 * The capital gets a third хороо select; the countryside deliberately stops at
 * сум (no баг), which is how parcels are actually addressed for bus transport.
 *
 * Values are the Cyrillic *names*, not p-codes, because `orders.ship_city` /
 * `ship_district` are plain text columns — this keeps the picker a drop-in
 * replacement for the old free-text inputs with no schema change.
 */
export function AddressFields({
  value,
  onChange,
  errors,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  errors?: { city?: string; district?: string };
}) {
  // Names are what we store, so map back to codes to drive the cascade.
  const aimag = AIMAGS.find((a) => a.name === value.city) ?? null;
  const child =
    getChildren(aimag?.code).find((c) => c.name === value.district) ?? null;
  const khoroos = getKhoroos(child?.code);
  const capital = isCapital(aimag?.code);

  function pickAimag(code: string) {
    // Changing аймаг invalidates everything below it.
    onChange({ city: getAimag(code)?.name ?? "", district: "", khoroo: null });
  }

  function pickChild(code: string) {
    const next = getChildren(aimag?.code).find((c) => c.code === code);
    onChange({ ...value, district: next?.name ?? "", khoroo: null });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Хот / Аймаг" error={errors?.city}>
        <Select value={aimag?.code ?? ""} onValueChange={pickAimag}>
          <SelectTrigger>
            <SelectValue placeholder="Сонгоно уу" />
          </SelectTrigger>
          <SelectContent>
            {AIMAGS.map((a) => (
              <SelectItem key={a.code} value={a.code}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={childLabel(aimag?.code)} error={errors?.district}>
        <Select
          value={child?.code ?? ""}
          onValueChange={pickChild}
          disabled={!aimag}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={aimag ? "Сонгоно уу" : "Эхлээд хот сонгоно уу"}
            />
          </SelectTrigger>
          <SelectContent>
            {getChildren(aimag?.code).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {capital && (
        <Field label="Хороо">
          <Select
            value={value.khoroo ? String(value.khoroo) : ""}
            onValueChange={(v) => onChange({ ...value, khoroo: Number(v) })}
            disabled={khoroos.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={child ? "Сонгоно уу" : "Эхлээд дүүрэг сонгоно уу"}
              />
            </SelectTrigger>
            <SelectContent>
              {khoroos.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {formatKhoroo(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

/**
 * Compose the structured parts into the single free-text detail line, the way
 * Mongolian addresses are normally written: "12-р хороо, 45-р байр 12 тоот".
 */
export function composeDetail(khoroo: number | null, detail: string): string {
  const rest = detail.trim();
  if (!khoroo) return rest;
  return rest ? `${formatKhoroo(khoroo)}, ${rest}` : formatKhoroo(khoroo);
}

