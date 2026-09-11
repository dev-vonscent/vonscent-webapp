"use client";

import { Check, MapPin, Pencil, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { AddressRow } from "@/db/types";

/**
 * The saved-address picker at the head of checkout.
 *
 * It replaced a "Хадгалсан хаяг" dropdown that sat in its own section above
 * the address form: the customer had to notice a select, open it, and read
 * four addresses squeezed onto one line each, and the form below stayed
 * visible the whole time as if it still wanted filling in. Here the addresses
 * *are* the field — the default one is chosen before the page is even
 * touched — and a new address is entered in a dialog.
 *
 * Хаяг бөглөх формыг хуудсан дээр нээхээ больж popup болгосон: хуудсанд гурван
 * cascading select + input байснаас захиалгын гол урсгал (хэн, хаана, хэзээ)
 * харагдахаа больдог. Шинэ хаягийг оруулмагц энд яг хадгалсан хаягтай ижил
 * карт болж, сонгогдсон байдлаар харагдана.
 */

/** Sentinel value for "the address entered in the dialog". */
export const NEW_ADDRESS = "__new__";

export interface AddressDraft {
  city: string;
  district: string;
  khoroo: number | null;
  detail: string;
}

export function SavedAddresses({
  addresses,
  value,
  onChange,
  draft,
  onAddNew,
}: {
  addresses: AddressRow[];
  /** An address id, or `NEW_ADDRESS`. */
  value: string;
  onChange: (value: string) => void;
  /** Popup-аар оруулсан шинэ хаяг (байвал карт болж харагдана). */
  draft?: AddressDraft | null;
  /** Popup нээх — шинээр нэмэх, эсвэл оруулсан хаягаа засах. */
  onAddNew: () => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-2.5">
      {addresses.map((a) => (
        <label
          key={a.id}
          className={cn(
            "bg-secondary hover:bg-accent has-checked:ring-foreground flex cursor-pointer items-start gap-3 rounded-xl p-4 ring-2 ring-transparent transition-all",
          )}
        >
          <RadioGroupItem value={a.id} className="mt-0.5" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{a.recipient}</span>
              {a.is_default && (
                <span className="bg-foreground text-background rounded-full px-1.5 py-px text-[10px] font-semibold">
                  Үндсэн
                </span>
              )}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              {a.phone}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">
              {[a.city, a.district, a.detail].filter(Boolean).join(", ")}
            </span>
          </span>
          <Check className="text-foreground mt-0.5 hidden size-4 shrink-0 in-[label:has(:checked)]:block" />
        </label>
      ))}

      {/* Popup-аас оруулсан хаяг — хадгалсан хаягуудтай ижил жинтэй карт. */}
      {draft && (
        <div className="bg-secondary has-checked:ring-foreground flex items-start gap-3 rounded-xl p-4 ring-2 ring-transparent transition-all">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
            <RadioGroupItem value={NEW_ADDRESS} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium">Шинэ хаяг</span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {[
                  draft.city,
                  draft.district,
                  draft.khoroo ? `${draft.khoroo}-р хороо` : null,
                  draft.detail,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={onAddNew}
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs transition-colors"
          >
            <Pencil className="size-3.5" />
            Засах
          </button>
        </div>
      )}

      {/* Bottom of the list: opens the dialog rather than revealing a form
          under it. Not a radio — nothing is chosen by pressing it. */}
      <button
        type="button"
        onClick={onAddNew}
        className="border-border hover:bg-accent flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-left transition-all"
      >
        <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full">
          <Plus className="size-4" />
        </span>
        <span className="text-sm font-medium">
          {draft ? "Өөр хаяг нэмэх" : "Шинэ хаяг нэмэх"}
        </span>
        <MapPin className="text-muted-foreground ml-auto size-4" />
      </button>
    </RadioGroup>
  );
}
