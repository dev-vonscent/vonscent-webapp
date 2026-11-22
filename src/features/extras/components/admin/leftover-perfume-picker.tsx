"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxScroll,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { PickerPopup } from "@/features/admin/components/customer-picker";
import { useProductOptions } from "@/features/admin/hooks/use-product-options";
import type { ProductOption } from "@/features/admin/lib/product-option";

const label = (p: ProductOption) => `${p.brand} — ${p.name}`;

/**
 * «Аль үнэртний шил вэ?» — каталогоос серверээр хайна (нуусан бараа ч орно:
 * декант нь дууссан ч шил нь үлдсэн байж болно).
 */
export function LeftoverPerfumePicker({
  value,
  onChange,
  disabled,
}: {
  value: { id: string; name: string; brand: string } | null;
  onChange: (next: ProductOption | null) => void;
  disabled?: boolean;
}) {
  const { q, setQ, items, loading } = useProductOptions([]);
  const valueId = value?.id;
  const valueName = value?.name;
  const valueBrand = value?.brand;
  const selected = React.useMemo<ProductOption | null>(
    () =>
      valueId
        ? {
            id: valueId,
            name: valueName ?? "",
            brand: valueBrand ?? "",
            isActive: true,
            availableMl: 0,
            priceByMl: {},
          }
        : null,
    [valueId, valueName, valueBrand],
  );
  const list = React.useMemo(() => {
    if (selected && !items.some((p) => p.id === selected.id)) {
      return [...items, selected];
    }
    return items;
  }, [items, selected]);

  return (
    <Combobox
      items={list}
      value={selected}
      disabled={disabled}
      onValueChange={(next: ProductOption | null) => onChange(next ?? null)}
      itemToStringLabel={label}
      isItemEqualToValue={(a: ProductOption, b: ProductOption) => a.id === b.id}
      filter={null}
      inputValue={q}
      onInputValueChange={setQ}
      onOpenChange={(open) => {
        if (!open) setQ("");
      }}
    >
      <ComboboxTrigger>
        <ComboboxValue placeholder="Үнэртэн сонгоно уу" />
      </ComboboxTrigger>
      <PickerPopup aria-busy={loading || undefined}>
        <ComboboxInput
          placeholder="Брэнд эсвэл нэрээр"
          aria-label="Үнэртэн хайх"
        />
        <ComboboxScroll>
          <ComboboxStatus>
            {loading && (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Хайж байна…
              </>
            )}
          </ComboboxStatus>
          <ComboboxEmpty>{!loading && "Ийм үнэртэн олдсонгүй."}</ComboboxEmpty>
          <ComboboxList>
            {(p: ProductOption) => (
              <ComboboxItem key={p.id} value={p}>
                <span className="truncate">{label(p)}</span>
                <span className="text-muted-foreground ml-auto pl-2 text-xs tabular-nums">
                  {p.availableMl}ml
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxScroll>
      </PickerPopup>
    </Combobox>
  );
}
