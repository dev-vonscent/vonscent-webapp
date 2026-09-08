"use client";

import { Check, MapPin, Plus } from "lucide-react";
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
 * touched — and the form only appears if the customer asks for a new one.
 *
 * `NEW_ADDRESS` is a sentinel value rather than a separate control so the
 * whole thing stays one radio group: "somewhere new" is just another choice,
 * and keyboard users arrow through it with the rest.
 */

export const NEW_ADDRESS = "__new__";

export function SavedAddresses({
  addresses,
  value,
  onChange,
}: {
  addresses: AddressRow[];
  /** An address id, or `NEW_ADDRESS`. */
  value: string;
  onChange: (value: string) => void;
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

      {/* Bottom of the list, as the last option rather than a button beside
          it — picking it is what reveals the form underneath. */}
      <label className="border-border hover:bg-accent has-checked:ring-foreground flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 ring-2 ring-transparent transition-all has-checked:border-transparent">
        <RadioGroupItem value={NEW_ADDRESS} className="sr-only" />
        <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full">
          <Plus className="size-4" />
        </span>
        <span className="text-sm font-medium">Шинэ хаяг нэмэх</span>
        <MapPin className="text-muted-foreground ml-auto size-4" />
      </label>
    </RadioGroup>
  );
}
