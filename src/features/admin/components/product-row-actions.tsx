"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MoreHorizontal,
  Plus,
  Minus,
  Coins,
  Pencil,
  Star,
  StarOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { editHref } from "@/features/admin/lib/return-to";
import { QuickPriceDialog } from "./quick-price-dialog";
import { StockAdjustDialog, type StockMode } from "./stock-adjust-dialog";
import type { AdminProduct } from "@/features/admin/api";
import { cn } from "@/lib/utils";

/**
 * Everything an operator does to a product on an ordinary day, on the row.
 *
 * `/admin/inventory` used to be a second screen holding half of this — ml on one
 * route, price on another, with no link either way, so fixing one product's two
 * numbers meant two searches. The client asked for one list; the row is where
 * that list can still hold four actions without becoming four columns of
 * controls.
 *
 * The menu is the same on both layouts, which is the point: a phone gets the
 * identical four actions, opened from a full-width button instead of a 40px
 * icon, and each dialog is a bottom sheet rather than a centred modal
 * (`ResponsiveDialog`). Nothing is desktop-only.
 */
export function ProductRowActions({
  product,
  /** Phone cards give the trigger the full row width; the table cell doesn't. */
  variant = "icon",
}: {
  product: AdminProduct;
  variant?: "icon" | "block";
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [pricing, setPricing] = React.useState(false);
  const [featuring, setFeaturing] = React.useState(false);
  const [stockMode, setStockMode] = React.useState<StockMode | null>(null);
  const label = `${product.brand} — ${product.name}`;
  // The full editor returns to this exact filtered list, not a bare one.
  const fullEditHref = editHref(product.id, params.toString());

  /** «Онцлох» тэмдгийг мөрөн дээрээс шууд солих (backlog C2). */
  async function toggleFeatured() {
    setFeaturing(true);
    try {
      const next = !product.isFeatured;
      const ok = await mutateJson(
        `/api/admin/products/${product.id}`,
        "PATCH",
        { isFeatured: next },
        "Онцлох тэмдэг солигдсонгүй",
      );
      if (ok) {
        toast.success(
          next
            ? `«${product.name}» онцлох боллоо. Нүүрийн онцлох хэсэгт харагдана.`
            : `«${product.name}» онцлохоос хасагдлаа.`,
        );
        router.refresh();
      }
    } finally {
      setFeaturing(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "block" ? (
            <Button variant="secondary" className="w-full">
              <MoreHorizontal className="size-4" />
              Үйлдэл
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${product.name} — үйлдэл`}
              className="ml-auto"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            // Radix restores focus to the trigger on close, and opening a
            // dialog in the same tick fights that. Defer to the next frame.
            onSelect={(e) => {
              e.preventDefault();
              requestAnimationFrame(() => setPricing(true));
            }}
            className={ITEM}
          >
            <Coins />
            Үнэ ба төлөв
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              requestAnimationFrame(() => setStockMode("restock"));
            }}
            className={ITEM}
          >
            <Plus />
            Нөөц нөхөх
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              requestAnimationFrame(() => setStockMode("correction"));
            }}
            // Nothing to take away, so the action would only ever produce the
            // server's floor rejection.
            disabled={product.onHandMl - product.reservedMl <= 0}
            className={ITEM}
          >
            <Minus />
            Үлдэгдэл залруулах
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void toggleFeatured()}
            disabled={featuring}
            className={ITEM}
          >
            {product.isFeatured ? <StarOff /> : <Star />}
            {product.isFeatured ? "Онцлохоос хасах" : "Онцлох болгох"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={ITEM}>
            <Link href={fullEditHref}>
              <Pencil />
              Бүрэн засварлах
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mounted only while open. A 20-row page carries 20 of these menus, and
          keeping both dialogs alive per row would put 40 `matchMedia`
          listeners and 40 controlled forms on the page for nothing — the same
          trap `data-table.tsx` documents for the old RestockControl. */}
      {pricing && (
        <QuickPriceDialog open onOpenChange={setPricing} product={product} />
      )}
      {stockMode !== null && (
        <StockAdjustDialog
          open
          onOpenChange={(o) => !o && setStockMode(null)}
          mode={stockMode}
          productId={product.id}
          productLabel={label}
          onHandMl={product.onHandMl}
          reservedMl={product.reservedMl}
        />
      )}
    </>
  );
}

/** 44px rows on a phone — this menu is the only way to reach these actions. */
const ITEM = cn("min-h-11 md:min-h-0");
