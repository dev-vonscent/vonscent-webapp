"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  resumeSavedCheckout,
  savedSubtotal,
  useDeleteSavedCheckout,
  useSavedCheckouts,
  type SavedCheckout,
} from "../saved-checkouts";

/**
 * «Миний захиалга» → «Дараа захиалах» табын жагсаалт (0116). Таб өөрөө
 * гарчиг тул энд гарчиггүй. Ачаалж байх үед юу ч зурахгүй; хоосон бол
 * `emptyState` (сүүлчийнхийг устгахад таб хоосон цагаан үлдэхгүй).
 */
export function SavedCheckouts({ emptyState }: { emptyState?: ReactNode }) {
  const { data: list = [], isPending } = useSavedCheckouts();
  const { mutate: remove } = useDeleteSavedCheckout();
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();

  if (isPending) return null;
  if (list.length === 0) return <>{emptyState}</>;

  // Серверээс ЭНД устгахгүй (клиент, 2026-10): checkout-оос буцаж гарсан
  // хүний хадгалсан захиалга алга болдог байв. Захиалга үүсэх, эсвэл
  // checkout дотор «Устгах» дарах үед л устна (saved-checkouts.ts).
  function resume(entry: SavedCheckout) {
    resumeSavedCheckout(entry);
    router.push("/checkout");
  }

  function confirmRemove(entry: SavedCheckout) {
    void confirm({
      title: "Хадгалсан захиалгыг устгах уу?",
      description: "Энэ захиалга «Дараа захиалах» жагсаалтаас устана.",
      confirmLabel: "Устгах",
      cancelLabel: "Буцах",
      destructive: true,
      action: async () => remove(entry.id),
    });
  }

  return (
    <section className="space-y-4">
      {confirmDialog}
      {list.map((entry) => (
        <SavedCard
          key={entry.id}
          entry={entry}
          onResume={() => resume(entry)}
          onRemove={() => confirmRemove(entry)}
        />
      ))}
    </section>
  );
}

function SavedCard({
  entry,
  onResume,
  onRemove,
}: {
  entry: SavedCheckout;
  onResume: () => void;
  onRemove: () => void;
}) {
  const lines = [
    ...entry.items.map((i) => ({
      key: i.key,
      name: `${i.brand} ${i.name}`,
      image: i.image,
      ml: i.ml,
      qty: i.qty,
    })),
    ...entry.collections.map((c) => ({
      key: c.key,
      name: c.name,
      image: c.image,
      ml: c.ml,
      qty: c.qty,
    })),
  ];
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const thumbs = lines.slice(0, 4);
  const extra = lines.length - thumbs.length;
  const first = lines[0];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">Хадгалсан захиалга</p>
            <p className="text-muted-foreground text-sm">
              {formatDateTime(entry.savedAt)} · {count} ширхэг
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {thumbs.map((l) => (
            <div
              key={l.key}
              className="bg-secondary relative size-14 shrink-0 overflow-hidden rounded-xl"
            >
              {l.image ? (
                <Image
                  src={l.image}
                  alt={l.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center">
                  <Package className="text-muted-foreground size-5" />
                </span>
              )}
            </div>
          ))}
          {extra > 0 && (
            <div className="bg-secondary text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-xl text-sm font-medium">
              +{extra}
            </div>
          )}
          {first && (
            <div className="ml-1 min-w-0">
              <p className="text-muted-foreground truncate text-sm">
                {first.name}
                {lines.length > 1 && ` ба бусад ${lines.length - 1}`}
              </p>
              <p className="text-muted-foreground text-xs">{first.ml}ml</p>
            </div>
          )}
        </div>
      </CardContent>

      <div className="px-5 pb-5">
        <Separator className="my-3" />
        {/* Утсан дээр (≈300px) дүн ба хоёр том товч нэг мөрөнд багтахгүй —
            товчнууд доор нь хоёр тэнцүү баганаар; `sm`-ээс дээш нэг мөр. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {/* Хадгалах үеийн үнэ — захиалахад checkout одоогийн үнээр бодно. */}
            <p className="text-muted-foreground text-xs">Барааны дүн</p>
            <p className="text-lg font-semibold">
              {formatPrice(savedSubtotal(entry))}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onRemove}
              className="hover:text-destructive gap-1.5"
            >
              <Trash2 className="size-4" />
              Устгах
            </Button>
            <Button
              size="lg"
              onClick={onResume}
              className="bg-cta text-cta-foreground hover:bg-cta/90"
            >
              Захиалах
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
