"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";
import { editHref } from "@/features/admin/lib/return-to";
import type { AdminProduct } from "@/features/admin/api";
import { cn } from "@/lib/utils";

/**
 * The picture and the name on the catalogue list, both pointing at the editor.
 *
 * The thumbnail used to open a dialog that was the only way to approve or
 * regenerate an AI image — a second, hidden editing surface reachable from a
 * 48px square. Everything it did now lives in the image studio at the top of
 * the edit page, so the obvious gesture (tap the product) does the obvious
 * thing, and the list stays a list.
 */
export interface ThumbProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  imageStatus: AdminProduct["imageStatus"];
  /** Gallery pictures not ticked for the storefront (0049). */
  hiddenImageCount: number;
}

/** Carries the list's own filters into the editor so saving comes back here. */
function useEditHref(id: string): string {
  const params = useSearchParams();
  return editHref(id, params.toString());
}

export function ProductThumbLink({
  product,
  className,
}: {
  product: ThumbProduct;
  /** Size utilities — the table cell and the phone card want different ones. */
  className?: string;
}) {
  const href = useEditHref(product.id);
  const busy =
    product.imageStatus === "pending" || product.imageStatus === "generating";

  return (
    <Link
      href={href}
      aria-label={`${product.name} — засах`}
      className={cn(
        "bg-muted text-muted-foreground relative block shrink-0 overflow-hidden rounded-md",
        className,
      )}
    >
      {busy ? (
        <span className="flex size-full items-center justify-center">
          <Loader2 className="size-4 animate-spin" />
        </span>
      ) : product.imageStatus === "failed" && !product.imageUrl ? (
        <span
          className="text-destructive flex size-full items-center justify-center"
          title="AI зураг амжилтгүй"
        >
          <AlertTriangle className="size-4" />
        </span>
      ) : product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center">
          <ImageIcon className="size-4" />
        </span>
      )}

      {/* Pictures are waiting to be picked — the edit page is where that
          happens, and this is the only hint the list can give. */}
      {product.hiddenImageCount > 0 && (
        <span
          title={`${product.hiddenImageCount} сонгогдоогүй зураг`}
          // Ringed in the page colour: the dot sits on an arbitrary photograph,
          // where either theme's accent alone can vanish into the pixels.
          className="bg-gold-strong ring-background absolute top-1 right-1 size-2 rounded-full ring-2"
        />
      )}
    </Link>
  );
}

export function ProductNameLink({
  product,
  className,
}: {
  product: ThumbProduct;
  className?: string;
}) {
  const href = useEditHref(product.id);
  return (
    <Link
      href={href}
      title={product.name}
      className={cn("hover:text-gold-strong font-medium", className)}
    >
      {product.name}
    </Link>
  );
}
