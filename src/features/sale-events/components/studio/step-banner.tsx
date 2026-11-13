"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bannerGaps } from "./studio-checklist";
import type { EventStudio } from "./use-event-studio";

/**
 * ④ Нүүрний баннер — S1-ийн ТҮР хувилбар: баннерыг одоохондоо «Нүүрний
 * баннер» хуудсанд хийж, энэ арга хэмжээтэй холбоно. S3-д баннерыг эндээс,
 * текстийг нь баннер дээр нь засдаг болно (studio-ux.md §5.4, D3, D6).
 */
export function StepBanner({ studio }: { studio: EventStudio }) {
  const { banner } = studio;
  const gaps = banner ? bannerGaps(banner) : [];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="bg-secondary aspect-14/5 w-full overflow-hidden rounded-lg">
        {banner?.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URL, админы thumbnail
          <img src={banner.thumb} alt="" className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
            {banner ? "Компьютерын зураг алга" : "Баннергүй"}
          </div>
        )}
      </div>

      {!banner ? (
        <p className="text-sm text-pretty">
          Энэ арга хэмжээнд баннер холбоогүй байна — нүүр хуудасны баннер
          солигдохгүй. Баннер заавал биш.
        </p>
      ) : gaps.length > 0 ? (
        <p className="text-warning text-sm text-pretty">
          Баннер дутуу: {gaps.join(", ")}. Бүрэн болтол нүүр хуудсанд гарахгүй.
        </p>
      ) : !banner.isActive ? (
        <p className="text-warning text-sm text-pretty">
          Баннер идэвхгүй байна — нүүр хуудсанд гарахгүй.
        </p>
      ) : (
        <p className="text-sm text-pretty">
          Баннер бэлэн. Арга хэмжээ эхлэхэд нүүр хуудсанд гарч, дуусахад өөрөө
          буцна.
        </p>
      )}
      {banner && banner.others > 0 && (
        <p className="text-muted-foreground text-sm">
          Энэ арга хэмжээнд өөр {banner.others} баннер холбоотой байна.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm text-pretty">
          Баннерыг одоохондоо «Нүүрний баннер» хуудсанд үүсгэж, тэндээс энэ арга
          хэмжээтэй холбоно. Хугацааг нь арга хэмжээнээс өөрөө авна.
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/heroes" target="_blank" rel="noreferrer">
            «Нүүрний баннер» хуудас нээх
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
