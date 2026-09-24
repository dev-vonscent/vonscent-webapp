import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import {
  getBaseCollections,
  getCollectionSettings,
} from "@/features/collections/api";
import { CollectionBrowser } from "@/features/collections/components/collection-browser";
import { BuildRoutePanel } from "@/features/collections/components/build-route-panel";
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
  const [collections, settings] = await Promise.all([
    getBaseCollections(),
    getCollectionSettings(),
  ]);

  /*
    Хямдралын хувь нь бодит багцуудаас тооцоологдоно — «5%» гэж гараар бичвэл
    админ хямдралаа өөрчлөхөд шууд худал болно. Хувь мэдэгдэхгүй (бүх багц
    0%) үед толгойн өгүүлбэр тоогүйгээр л уншигдана.

    Өмнө нь энд «1 багц · 4 үнэртэн · 5 / 10 / 20ml» гэсэн тоймын мөр байв:
    доорх сүлжээ өөрөө багцуудаа, тэдгээрийн үнэртний тоо, хэмжээг нь
    харуулдаг тул тэр мөр нь нэг дэлгэцэнд ижил зүйлийг хоёр удаа хэлж
    байсан.
  */
  const discountSpan = (() => {
    const pcts = collections
      .map((c) => c.discountRange.max)
      .filter((n) => n > 0);
    return range(pcts);
  })();

  return (
    <div className="mx-auto max-w-352 px-4 py-6 md:px-8">
      {/*
        Толгой нь хоёр замыг зэрэг харуулна: зүүн талд бэлэн багцууд (энэ
        хуудас өөрөө), баруун талд өөрөө угсрах.

        Тэгшлэлт нь ДЭЭД ирмэгээр. Өмнө нь `items-end` байсан: доод ирмэг нь
        таарч байсан ч панель нь гарчгаасаа өндөр тул нүдэнд гарчгаас дээш
        хөвж, хоёр нь өөр түвшинд байгаа мэт харагддаг байв.
      */}
      <div className="mb-6 flex flex-col gap-5 md:mb-8 md:flex-row md:items-start md:justify-between md:gap-10">
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            Багц
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {discountSpan
              ? `Багцаар авбал тусад нь авснаас ${discountSpan}% хямд.`
              : "Багцаар авбал тусад нь авснаас хямд."}
          </p>
        </div>
        {settings.customEnabled && <BuildRoutePanel />}
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
            customEnabled={settings.customEnabled}
          />
        </Suspense>
      )}
    </div>
  );
}
