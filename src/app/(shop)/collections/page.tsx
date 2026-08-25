import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { getBaseCollections } from "@/features/collections/api";
import { CollectionBrowser } from "@/features/collections/components/collection-browser";
import { Button } from "@/components/ui/button";

/** ISR — collections are public data (see product/catalog pages). */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Багц",
  description:
    "Сонгож бэлдсэн үнэртний багцууд — 4 үнэртэн, хямдралтай үнэ, нэмэлт бэлэгтэй.",
};

export default async function CollectionsPage() {
  const collections = await getBaseCollections();

  return (
    <div className="mx-auto max-w-352 px-4 py-6 md:px-8">
      {collections.length === 0 ? (
        <div className="border-border flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-24 text-center">
          <PackageOpen className="text-muted-foreground size-10" />
          <div>
            <p className="font-medium">Багц одоогоор алга</p>
            <p className="text-muted-foreground text-sm">
              Тун удахгүй онцгой багцууд нэмэгдэнэ.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/catalog">Каталог үзэх</Link>
          </Button>
        </div>
      ) : (
        <CollectionBrowser collections={collections} />
      )}
    </div>
  );
}
