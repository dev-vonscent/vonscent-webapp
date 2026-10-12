import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, MessageSquarePlus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface ReviewableItem {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  /** Хэрэглэгч энэ усанд аль хэдийн сэтгэгдэл бичсэн эсэх. */
  reviewed: boolean;
}

/**
 * «Миний захиалга»-ын дэлгэрэнгүй дээрх сэтгэгдлийн урилга (0117).
 *
 * Хүргэгдэхээс өмнө зөвхөн урилгын зурвас; хүргэгдсэний дараа ус бүрт
 * барааны хуудасны сэтгэгдлийн хэсэг рүү үсрэх товч. Оноо нь сэтгэгдэл
 * бичигдэх үед DB-ийн trigger-ээр олгогдоно — энд зөвхөн харуулна.
 */
export function OrderReviewPrompt({
  delivered,
  reviewPoints,
  items,
}: {
  delivered: boolean;
  reviewPoints: number;
  items: ReviewableItem[];
}) {
  if (items.length === 0) return null;
  const reward =
    reviewPoints > 0
      ? ` +${reviewPoints.toLocaleString("mn-MN")} V point цуглуулаарай`
      : "";

  if (!delivered) {
    return (
      <p className="bg-secondary text-muted-foreground rounded-xl px-4 py-3 text-sm">
        Бараагаа хэрэглэж үзээд сэтгэгдлээ бичээд
        {reward || " бусдад туслаарай"}. Захиалга хүргэгдсэний дараа сэтгэгдэл
        бичих товч энд гарна.
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Сэтгэгдэл бичих</h2>
          <p className="text-muted-foreground text-sm">
            Бараагаа хэрэглэж үзээд сэтгэгдлээ бичээд
            {reward ? `${reward} (ус бүрт нэг удаа)` : " бусдад туслаарай"}.
          </p>
        </div>
        <ul className="divide-border divide-y">
          {items.map((i) => (
            <li
              key={i.productId}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="border-border bg-secondary relative size-12 shrink-0 overflow-hidden rounded-lg border">
                {i.image ? (
                  <Image
                    src={i.image}
                    alt={i.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <Package className="text-muted-foreground size-5" />
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm">
                {i.brand} {i.name}
              </p>
              {i.reviewed ? (
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href={`/products/${i.slug}#reviews`}>
                    <CheckCircle2 className="text-success size-4" />
                    Бичсэн
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/products/${i.slug}#reviews`}>
                    <MessageSquarePlus className="size-4" />
                    Сэтгэгдэл бичих
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
