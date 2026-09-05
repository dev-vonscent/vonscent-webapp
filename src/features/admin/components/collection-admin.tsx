"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GENDER_LABEL } from "@/lib/constants";

export interface AdminCollection {
  id: string;
  slug: string;
  name: string;
  gender: "male" | "female" | "unisex";
  description: string | null;
  /** Default %, used for any size without its own row (0051). */
  discount_pct: number | string;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  collection_items: { product_id: string; sort_order: number }[];
  /** Only loaded by the edit page — the list does not need them. */
  collection_ml_discounts?: {
    ml: number;
    discount_pct: number | string | null;
    /** Тухайн хэмжээний тогтмол үнэ (0054) — байвал хувийг орлоно. */
    price: number | null;
  }[];
  collection_tags?: { tags: { slug: string } | null }[];
  collection_custom_tags?: { custom_tags: { slug: string } | null }[];
}

/**
 * The bundle list. Creating and editing live on their own routes
 * (`collections/new`, `collections/[id]/edit`) rather than in a modal, the way
 * products already worked: the editor holds a searchable list of every perfume
 * in the shop, which a dialog could only ever show a few rows of at a time.
 * This component keeps the list and the one action that has nowhere else to
 * go — delete, which needs its confirmation right where the row is.
 */
export function CollectionAdmin({
  collections,
}: {
  collections: AdminCollection[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();

  async function remove(id: string, collectionName: string) {
    if (
      !(await confirm({
        title: `«${collectionName}» багцыг устгах уу?`,
        description:
          "Багц болон түүний барааны жагсаалт устна. Багц дэлгүүрээс алга болно. Буцаах боломжгүй.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    if (
      !(await mutate(
        `/api/admin/collections/${id}`,
        { method: "DELETE" },
        "Багц устсангүй",
      ))
    )
      return;
    toast.success("Багц устлаа.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {collections.length} багц
        </p>
        <Button asChild>
          <Link href="/admin/collections/new">
            <Plus className="size-4" /> Шинэ багц
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        {collections.map((c) => (
          <div
            key={c.id}
            className="bg-card flex items-center gap-3 rounded-xl p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                {!c.is_active && <Badge variant="secondary">Нуусан</Badge>}
                {c.is_featured && <Badge>Онцлох</Badge>}
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {GENDER_LABEL[c.gender]} · −{Number(c.discount_pct)}% ·{" "}
                {c.collection_items.length} үнэртэн
              </p>
            </div>
            <Link
              href={`/admin/collections/${c.id}/edit`}
              className="text-muted-foreground hover:text-foreground p-2"
              aria-label={`${c.name} багцыг засах`}
            >
              <Pencil className="size-4" />
            </Link>
            <button
              onClick={() => remove(c.id, c.name)}
              className="text-muted-foreground hover:text-destructive p-2"
              aria-label={`${c.name} багцыг устгах`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {collections.length === 0 && (
          <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            Багц алга. «Шинэ багц»-аар эхлүүлнэ үү.
          </p>
        )}
      </div>
    </div>
  );
}
