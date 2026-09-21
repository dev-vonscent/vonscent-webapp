import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import {
  getBaseCollections,
  getCollectionSettings,
} from "@/features/collections/api";
import { getGiftSettings } from "@/features/content/api";
import { CollectionBrowser } from "@/features/collections/components/collection-browser";
import { BuildCtaCard } from "@/features/collections/components/build-cta-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/** ISR — collections are public data (see product/catalog pages). */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Багц",
  description:
    "Сонгож бэлдсэн үнэртний багцууд — хэд хэдэн үнэртнийг нэг хэмжээгээр, тусад нь авахаас хямдаар.",
};

/** «3-5» гэх мэт муж, эсвэл бүгд ижил бол ганц тоо. */
function range(values: number[]): string | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}` : `${min}-${max}`;
}

export default async function CollectionsPage() {
  const [collections, gift, settings] = await Promise.all([
    getBaseCollections(),
    getGiftSettings(),
    getCollectionSettings(),
  ]);
  // «Бэлэгтэй» тэмдэг зөвхөн бэлгийн сан ажиллаж байгаа үед (backlog A2).
  const giftPoolEnabled = gift.enabled && gift.productIds.length > 0;

  /*
    Гурван тоо нь бодит багцуудаас тооцоологдоно — «4 үнэртэн», «5% хямд» гэж
    гараар бичвэл админ багцаа өөрчлөхөд шууд худал болно. Багц байхгүй үед
    энэ мөр огт гарахгүй (доор EmptyState ажиллана).
  */
  const facts = [
    collections.length > 0 &&
      `${range(collections.map((c) => c.members.length))} үнэртэн`,
    (() => {
      const mls = [...new Set(collections.flatMap((c) => c.availableMls))].sort(
        (a, b) => a - b,
      );
      return mls.length > 0 ? `${mls.join(" / ")}ml` : null;
    })(),
    (() => {
      const pcts = collections
        .map((c) => c.discountRange.max)
        .filter((n) => n > 0);
      const span = range(pcts);
      return span ? `${span}% хямд` : null;
    })(),
  ].filter((f): f is string => Boolean(f));

  return (
    <div className="mx-auto max-w-352 px-4 py-6 md:px-8">
      <div className="mb-6 space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
          Багц
        </h1>
        <p className="text-muted-foreground text-sm text-balance">
          Хэд хэдэн үнэртэн, нэг хэмжээгээр — тусад нь авахаас хямд.
        </p>
        {facts.length > 0 && (
          <ul className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {facts.map((f, i) => (
              <li key={f} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>·</span>}
                <span className="text-foreground font-medium">{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {collections.length === 0 ? (
        <EmptyState
          size="lg"
          icon={PackageOpen}
          title="Багц одоогоор алга"
          description="Тун удахгүй онцгой багцууд нэмэгдэнэ."
          action={
            <Button asChild variant="outline">
              <Link href="/catalog">Каталог үзэх</Link>
            </Button>
          }
        />
      ) : (
        // Шүүлт нь URL-д байдаг тул browser нь `useSearchParams` уншина —
        // энэ хуудас ISR-ээр урьдчилан зурагддаг учир Suspense хэрэгтэй.
        <Suspense>
          <CollectionBrowser
            collections={collections}
            giftPoolEnabled={giftPoolEnabled}
            trailing={
              settings.customEnabled ? (
                <BuildCtaCard
                  minItems={settings.minItems}
                  discountPct={settings.customDiscountPct}
                />
              ) : null
            }
          />
        </Suspense>
      )}
    </div>
  );
}
