import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { getBaseCollections } from "@/features/collections/api";
import { getGiftSettings } from "@/features/content/api";
import { CollectionBrowser } from "@/features/collections/components/collection-browser";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/** ISR — collections are public data (see product/catalog pages). */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Багц",
  description:
    "Сонгож бэлдсэн үнэртний багцууд — 4 үнэртэн, хямдралтай үнэ, 1мл бэлгийн дээжтэй.",
};

export default async function CollectionsPage() {
  const [collections, gift] = await Promise.all([
    getBaseCollections(),
    getGiftSettings(),
  ]);
  // «Бэлэгтэй» тэмдэг зөвхөн бэлгийн сан ажиллаж байгаа үед (backlog A2).
  const giftPoolEnabled = gift.enabled && gift.productIds.length > 0;

  return (
    <div className="mx-auto max-w-352 px-4 py-6 md:px-8">
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
        <CollectionBrowser
          collections={collections}
          giftPoolEnabled={giftPoolEnabled}
        />
      )}
    </div>
  );
}
