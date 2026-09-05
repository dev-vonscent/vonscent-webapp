"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { toast } from "@/lib/toast";
import { adminFetch } from "@/features/admin/lib/mutate";
import { ML_SIZES } from "@/lib/constants";
import {
  VariantPriceTable,
  unpricedActiveSizes,
  type VariantDraft,
} from "./variant-price-table";
import type { AdminProduct } from "@/features/admin/api";

/**
 * The operator's one-minute job, on one screen.
 *
 * Repricing used to mean a full page load of a six-card, ~30-field edit form
 * where the prices are card four — and saving pushed back to an unfiltered list
 * with no confirmation. Price, the low-stock threshold and the published toggle
 * are the three things that actually change every day, so they get a dialog on
 * the row and the list keeps its filters.
 *
 * Everything else about the product still lives on the edit page; this is a
 * shortcut, not a second editor.
 */
export function QuickPriceDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProduct;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const [isActive, setIsActive] = React.useState(product.isActive);
  const [lowStockMl, setLowStockMl] = React.useState(String(product.lowStockMl));
  const [variants, setVariants] = React.useState<VariantDraft[]>(() =>
    draftFrom(product),
  );

  // Re-seed on open: the row behind the dialog may have been refreshed since
  // the component mounted, and a stale price silently overwrites a newer one.
  React.useEffect(() => {
    if (open) {
      setVariants(draftFrom(product));
      setIsActive(product.isActive);
      setLowStockMl(String(product.lowStockMl));
      setShowErrors(false);
      setMsg(null);
    }
  }, [open, product]);

  const unpriced = unpricedActiveSizes(variants);

  async function save() {
    if (unpriced.length > 0) {
      setShowErrors(true);
      setMsg(
        `${unpriced.join(", ")}ml зарахаар тэмдэглэсэн ч үнэгүй байна. Үнэ оруулах эсвэл «Зарна»-г авна уу.`,
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants,
          isActive,
          lowStockMl: Math.max(0, Number(lowStockMl) || 0),
        }),
      });
      if (!res.ok) {
        // The server's reason, not a content-free "Алдаа гарлаа."
        setMsg(`Хадгалж чадсангүй: ${res.error}`);
        return;
      }
      // The change is live for customers the moment it lands, so say so —
      // this write used to complete in silence.
      toast.success(
        isActive
          ? `«${product.name}» хадгалагдлаа. Шинэ үнэ сайтад шууд харагдана.`
          : `«${product.name}» хадгалагдлаа. Бараа сайтад харагдахгүй байна.`,
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={busy ? () => {} : onOpenChange}
      title="Үнэ ба төлөв"
      description={`${product.brand} — ${product.name}`}
      className="sm:max-w-lg"
    >
      <div className="space-y-4">
        <VariantPriceTable
          variants={variants}
          onChange={setVariants}
          showErrors={showErrors}
          idPrefix={`quick-${product.id}`}
        />

        <Field
          label="Доод хязгаар (ml)"
          hint="Боломжит үлдэгдэл үүнээс доош ороход жагсаалтад «Бага» гэж тэмдэглэнэ."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={lowStockMl}
            onChange={(e) => setLowStockMl(e.target.value)}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
          <Checkbox
            checked={isActive}
            onCheckedChange={(v) => setIsActive(Boolean(v))}
          />
          Идэвхтэй (сайтад харагдана)
        </label>

        {msg && (
          // role="alert" so a save failure is announced, not just painted.
          <p role="alert" className="bg-secondary rounded-md px-3 py-2 text-sm">
            {msg}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

/** Every store size gets a row; sizes the product lacks start unticked at 0₮. */
function draftFrom(product: AdminProduct): VariantDraft[] {
  return ML_SIZES.map((ml) => {
    const v = product.variants.find((x) => x.ml === ml);
    return v
      ? { ml, price: v.price, salePrice: v.salePrice, active: v.isActive }
      : { ml, price: 0, salePrice: null, active: false };
  });
}
