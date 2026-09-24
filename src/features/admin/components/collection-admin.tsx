"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { adminFetch, mutate } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
const POLL_MS = 4000;

export function CollectionAdmin({
  collections,
  generatingIds = [],
}: {
  collections: AdminCollection[];
  /** AI зураг нь дараалалд эсвэл үүсч байгаа багцууд. */
  generatingIds?: string[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();

  // AI зураг үүсч байгаа багцуудыг 4 секунд тутам шалгана. Дуусахад
  // зураггүй багцын зураг сервер дээр автоматаар хадгалагдсан байдаг тул
  // шинэ зургийг нь шууд харуулна.
  const [busy, setBusy] = React.useState(() => new Set(generatingIds));
  const [images, setImages] = React.useState<Record<string, string | null>>({});
  const busyKey = [...busy].sort().join(",");
  React.useEffect(() => {
    if (!busyKey) return;
    let alive = true;
    const read = async () => {
      const r = await adminFetch<{
        statuses?: {
          collectionId: string;
          busy: boolean;
          imageUrl: string | null;
        }[];
      }>(`/api/admin/collections/image-status?ids=${busyKey}`);
      const statuses = r.ok ? (r.data?.statuses ?? []) : [];
      if (!alive || !statuses.length) return;
      setImages((prev) => ({
        ...prev,
        ...Object.fromEntries(
          statuses.map((s) => [s.collectionId, s.imageUrl]),
        ),
      }));
      const done = statuses.filter((s) => !s.busy).map((s) => s.collectionId);
      if (done.length)
        setBusy((prev) => {
          const next = new Set(prev);
          done.forEach((id) => next.delete(id));
          return next;
        });
    };
    const iv = setInterval(() => void read(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [busyKey]);

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
            <CollectionThumb
              url={c.id in images ? images[c.id] : c.image_url}
              generating={busy.has(c.id)}
            />
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

/** Багцын зургийн жижиг хувилбар; AI зураг үүсч байхад loader давхарлана. */
function CollectionThumb({
  url,
  generating,
}: {
  url: string | null;
  generating: boolean;
}) {
  return (
    <div className="bg-muted/40 relative size-12 shrink-0 overflow-hidden rounded-lg">
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          unoptimized
          sizes="48px"
          className="object-cover"
        />
      ) : (
        !generating && (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <ImageIcon className="size-4" />
          </div>
        )
      )}
      {generating && (
        <div
          className="bg-background/60 absolute inset-0 flex items-center justify-center"
          title="AI зураг үүсч байна"
        >
          <Loader2 className="text-foreground size-4 animate-spin" />
          <span className="sr-only">AI зураг үүсч байна</span>
        </div>
      )}
    </div>
  );
}
