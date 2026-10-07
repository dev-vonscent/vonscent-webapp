"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bookmark, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * «Миний захиалга» дээрх «Дараа авахаар хадгалсан» жагсаалт (0116).
 * Хоосон эсвэл ачаалж байх үед юу ч зурахгүй — захиалгын жагсаалт өөрөө
 * хуудасны гол агуулга.
 */
export function SavedCheckouts() {
  const { data: list = [] } = useSavedCheckouts();
  const { mutate: remove } = useDeleteSavedCheckout();
  const router = useRouter();

  if (list.length === 0) return null;

  function resume(entry: SavedCheckout) {
    resumeSavedCheckout(entry);
    // Мөрүүд нь одоо сагсанд — серверийн хуулбар хэрэггүй болсон.
    remove(entry.id);
    router.push("/checkout");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Bookmark className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">Дараа авахаар хадгалсан</h2>
        <span className="text-muted-foreground text-sm">{list.length}</span>
      </div>
      <div className="space-y-4">
        {list.map((entry) => (
          <SavedCard
            key={entry.id}
            entry={entry}
            onResume={() => resume(entry)}
            onRemove={() => remove(entry.id)}
          />
        ))}
      </div>
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Устгах"
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <Trash2 className="size-4" />
          </Button>
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
        <div className="flex items-center justify-between gap-3">
          <div>
            {/* Хадгалах үеийн үнэ — захиалахад checkout одоогийн үнээр бодно. */}
            <p className="text-muted-foreground text-xs">Барааны дүн</p>
            <p className="text-lg font-semibold">
              {formatPrice(savedSubtotal(entry))}
            </p>
          </div>
          <Button
            size="lg"
            onClick={onResume}
            className="bg-cta text-cta-foreground hover:bg-cta/90 shrink-0"
          >
            Захиалах
          </Button>
        </div>
      </div>
    </Card>
  );
}
