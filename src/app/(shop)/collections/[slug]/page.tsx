import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getCollectionBySlug } from "@/features/collections/api";
import { CollectionDetail } from "@/features/collections/components/collection-detail";
import { GENDER_LABEL } from "@/lib/constants";
import { formatDiscountRange } from "@/features/collections/pricing";

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

  return (
    <div className="mx-auto max-w-352 p-4 sm:py-8 md:px-8">
      <Breadcrumb aria-label="Замын мөр" className="mb-6 hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Нүүр</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/collections">Багц</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{collection.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

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
              {collection.discountRange.max > 0 && (
                <Badge variant="sale" className="w-fit backdrop-blur-sm">
                  −{formatDiscountRange(collection.discountRange)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-muted-foreground text-sm tracking-wide uppercase">
              {GENDER_LABEL[collection.gender]} багц
            </span>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {collection.name}
            </h1>
          </div>

          <CollectionDetail collection={collection} />
        </div>
      </div>
    </div>
  );
}
