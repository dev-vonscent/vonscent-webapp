import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Gift } from "lucide-react";
import {
  getCollectionBySlug,
  getGiftCandidates,
} from "@/features/collections/api";
import { CollectionDetail } from "@/features/collections/components/collection-detail";
import { GENDER_LABEL } from "@/lib/constants";

export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Багц олдсонгүй" };
  return {
    title: `${collection.name} — Багц`,
    description: collection.description.slice(0, 160),
    // og:image comes from the sibling opengraph-image.tsx file convention.
    openGraph: { url: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const giftCandidates = collection.giftEnabled
    ? await getGiftCandidates(
        collection.members.map((m) => m.productId),
        collection.giftMl,
      )
    : [];

  return (
    <div className="mx-auto max-w-352 p-4  sm:py-8 md:px-8">
      <nav className="text-muted-foreground mb-6 hidden text-sm sm:block">
        <Link href="/" className="hover:text-foreground">
          Нүүр
        </Link>{" "}
        /{" "}
        <Link href="/collections" className="hover:text-foreground">
          Багц
        </Link>{" "}
        / <span className="text-foreground">{collection.name}</span>
      </nav>

      <div className="grid gap-6 sm:gap-10 lg:grid-cols-2 lg:items-start">
        {/* Cover */}
        <div className="lg:sticky lg:top-(--header-offset) lg:self-start">
          <div className="border-border bg-muted relative aspect-square overflow-hidden rounded-2xl border">
            {collection.image && (
              <Image
                src={collection.image}
                alt={collection.name}
                fill
                sizes="(max-width: 1024px) 100vw, 44rem"
                className="object-cover"
                priority
              />
            )}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {collection.discountPct > 0 && (
                <Badge variant="sale" className="w-fit backdrop-blur-sm">
                  −{collection.discountPct}%
                </Badge>
              )}
              {collection.giftEnabled && (
                <Badge className="bg-foreground/85 text-background w-fit gap-1 backdrop-blur-sm">
                  <Gift className="size-3" /> Бэлэгтэй
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-muted-foreground text-sm uppercase tracking-wide">
              {GENDER_LABEL[collection.gender]} багц
            </span>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {collection.name}
            </h1>
          </div>

          <CollectionDetail
            collection={collection}
            giftCandidates={giftCandidates}
          />
        </div>
      </div>
    </div>
  );
}
