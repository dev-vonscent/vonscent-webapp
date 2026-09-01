"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/features/admin/lib/mutate";
import type { BrandOption } from "@/lib/types";

/**
 * Brand picker for the product form (0050_brands.sql).
 *
 * Brand used to be a free-text input, which is how «Tom ford» and «Tom Ford»
 * became two houses in the catalog filter. This picks from the brand list
 * instead — and because an operator meets a brand the shop has never sold
 * halfway through creating a product, adding one is a dialog here rather than
 * a trip to another page and a lost form.
 *
 * The value stays the brand **name**, not an id: that is what
 * `products.brand` stores and what every reader displays, so the surrounding
 * form does not have to change shape.
 *
 * Names only, no logo artwork. This form is about the product; a logo is the
 * brand list's business, so it is uploaded on the Брэнд page and shown on the
 * storefront — putting it here too only crowded the field an operator is
 * actually reading.
 */

export function BrandSelect({
  value,
  onChange,
  brands,
  required = true,
}: {
  value: string;
  onChange: (name: string) => void;
  brands: BrandOption[];
  required?: boolean;
}) {
  const [options, setOptions] = React.useState<BrandOption[]>(brands);
  const [selectOpen, setSelectOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  React.useEffect(() => setOptions(brands), [brands]);

  /**
   * A product may already carry a brand that is hidden, or that predates the
   * list. Showing it as an option keeps the select from silently blanking a
   * field the operator never touched.
   */
  const visible = React.useMemo(() => {
    const shown = options.filter(
      (b) => b.isActive || b.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (
      value.trim() &&
      !shown.some((b) => b.name.toLowerCase() === value.trim().toLowerCase())
    ) {
      return [
        {
          id: `orphan:${value}`,
          slug: "",
          name: value,
          logoUrl: null,
          sortOrder: -1,
          isActive: true,
        } satisfies BrandOption,
        ...shown,
      ];
    }
    return shown;
  }, [options, value]);

  /**
   * Demo mode ships no brand list, and a dropdown with nothing in it is a
   * field that cannot be filled — fall back to the plain input it replaced.
   */
  if (!brands.length) {
    return (
      <Input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Dior"
      />
    );
  }

  function handleCreated(brand: BrandOption) {
    setOptions((prev) =>
      [...prev.filter((b) => b.id !== brand.id), brand].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    );
    onChange(brand.name);
    setDialogOpen(false);
  }

  return (
    <>
      <Select
        open={selectOpen}
        onOpenChange={setSelectOpen}
        value={value || undefined}
        onValueChange={onChange}
      >
        <SelectTrigger aria-label="Брэнд">
          <SelectValue placeholder="Брэнд сонгох" />
        </SelectTrigger>
        <SelectContent>
          {/*
            «Add a brand» is an action, not one of the brands, so it is a
            button rather than a SelectItem. As an item it was selectable: it
            could be landed on with the arrow keys, matched by typeahead, and
            — because the value round-trips through `products.brand` — it was
            one stray Enter away from being saved as a brand name.

            Sticky rather than last, so it stays reachable at thirty-odd
            brands instead of being a scroll away.

            `-top-1` rather than `top-0`: a sticky offset is measured from the
            scrollport's *padding* box, and Radix's viewport carries `p-1`, so
            `top-0` parks the bar 4px down and leaves a strip that scrolling
            brand names show through. The matching negative margins let it span
            that padding on all sides instead of floating inside it.
          */}
          <div className="bg-popover border-border sticky -top-1 z-10 -mx-1 -mt-1 mb-1 border-b p-1 ">
            <button
              type="button"
              onClick={() => {
                setSelectOpen(false);
                setDialogOpen(true);
              }}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium outline-none"
            >
              <Plus className="size-4" />
              Шинэ брэнд нэмэх
            </button>
          </div>
          {visible.map((b) => (
            <SelectItem key={b.id} value={b.name}>
              <span className="flex items-center gap-2">
                <span className="truncate">{b.name}</span>
                {!b.isActive && (
                  <span className="text-muted-foreground text-xs">
                    (нуугдсан)
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <NewBrandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={options}
        onCreated={handleCreated}
        onPickExisting={(b) => {
          onChange(b.name);
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function NewBrandDialog({
  open,
  onOpenChange,
  existing,
  onCreated,
  onPickExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: BrandOption[];
  onCreated: (brand: BrandOption) => void;
  onPickExisting: (brand: BrandOption) => void;
}) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset on open so a cancelled attempt doesn't reappear next time.
  React.useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const duplicate = React.useMemo(
    () =>
      existing.find(
        (b) => b.name.trim().toLowerCase() === name.trim().toLowerCase(),
      ) ?? null,
    [existing, name],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    // Typing a brand that already exists is the common slip, and it is not an
    // error — it is the brand they wanted. Select it instead of scolding.
    if (duplicate) {
      onPickExisting(duplicate);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<{ brand?: BrandOption }>(
        "/api/admin/brands",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      if (!res.ok) {
        setError(
          res.demo
            ? "Demo горим: Supabase холбогдсоны дараа хадгалагдана."
            : res.error.includes("DUPLICATE")
              ? "Энэ брэнд аль хэдийн бүртгэлтэй байна."
              : res.error.includes("NOT_MIGRATED")
                ? "Өгөгдлийн сан бэлэн биш байна (0050_brands.sql)."
                : res.error.includes("BAD_NAME")
                  ? "Нэрийг латинаар бичнэ үү."
                  : res.error,
        );
        return;
      }
      if (res.data?.brand) onCreated(res.data.brand);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Шинэ брэнд</DialogTitle>
        <DialogDescription>
          Нэмсэн брэнд шууд сонгогдож, брэндийн жагсаалтад бүртгэгдэнэ.
        </DialogDescription>

        {/* Not a <form>: this dialog is rendered inside the product form, and
            a nested form would submit the product on Enter. */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-brand-name">Нэр</Label>
            <Input
              id="new-brand-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit(e);
                }
              }}
              placeholder="Dior"
            />
            {duplicate && (
              <p className="text-muted-foreground text-xs">
                «{duplicate.name}» бүртгэлтэй байна — хадгалахад түүнийг
                сонгоно.
              </p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Болих
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={submit}
            >
              {duplicate ? "Сонгох" : busy ? "Хадгалж байна…" : "Нэмэх"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
