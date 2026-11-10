import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DeliveryReturnsText } from "@/components/shared/delivery-returns-text";
import { JsonLd, breadcrumbJsonLd } from "@/components/shared/json-ld";
import {
  ExtraGallery,
  VariantImageProvider,
} from "@/features/extras/components/variant-image";
import { getBottlesFor, getShopExtra } from "@/features/extras/api";
import { BottleList } from "@/features/extras/components/product-extras";
import { ExtraPurchase } from "@/features/extras/components/extra-purchase";
import { BOTTLE_KIND, bottleKind } from "@/features/extras/lib/bottle-kind";
import {
  BOTTLE_TABS,
  EXTRA_SECTION,
  extraSection,
} from "@/features/extras/lib/sections";
import {
  bottleSizeText,
  eyebrowText,
  repeatsName,
} from "@/features/extras/lib/display";
import { NoteColumn } from "@/features/products/components/note-column";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { formatPrice } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

/** ISR — үнэртний хуудастай ижил (cookie-гүй client, revalidatePublic). */
export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!(await isFeatureEnabled("extras_shop"))) return {};
  const { slug } = await params;
  const extra = await getShopExtra(slug);
  if (!extra) return { title: "Бараа олдсонгүй" };
  const { card } = extra;
  return {
    title: card.leftover
      ? `${card.name} — ${card.leftover.brand}`
      : `${card.name} — ${card.categoryName}`,
    description: (
      extra.description ||
      `${card.categoryName} — ${formatPrice(card.fromPrice)}-өөс. vonscent.mn`
    ).slice(0, 160),
    ...pageMetadata(`/extras/${card.slug}`),
  };
}

/**
 * Нэмэлт барааны хуудас (extras-shop-plan §9): галерей, хувилбар, үнэ,
 * «Сагсанд нэмэх». Үлдэгдэлтэй шил нь ганц ширхэг — эх үнэртний хуудас руу
 * холбоостой. Туг `extras_shop` хаалттай бол 404.
 */
export default async function ExtraPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { slug } = await params;
  const extra = await getShopExtra(slug);
  if (!extra) notFound();
  const { card } = extra;
  const leftover = card.leftover;
  const size = bottleSizeText(card);
  const perMl =
    leftover && leftover.remainingMl > 0
      ? Math.round(card.fromPrice / leftover.remainingMl)
      : null;
  const kind = bottleKind(card.categorySlug, card.mode);
  // «Энэ үнэрийн бусад шил» (клиент, 2026-11-10): хоосон шилийг харж буй
  // хүнд бүтэн / үлдэгдэлтэй нь — бодит сонголт. Дагалдах хэрэгсэлд юу ч
  // санал болгохгүй: бараа цөөн, бүгд `/accessories`-д нэг дэлгэцэнд, бэлгийн
  // савыг төлбөрийн хуудасны «Бэлгийн боодол» асууна (хуучин «Хамт авдаг»).
  const otherBottles =
    kind && extra.productId
      ? (await getBottlesFor(extra.productId)).filter((b) => b.id !== card.id)
      : [];
  // Хувилбарын зураг (5ml шприц, жижиг хайрцаг) галерейд байх ёстой —
  // эс бөгөөс хувилбар сонгоход галерей шилжих зураггүй.
  const gallery = [
    ...new Set([
      ...extra.images,
      ...extra.variants.flatMap((v) => (v.imageUrl ? [v.imageUrl] : [])),
    ]),
  ];
  const eyebrow = eyebrowText(card);
  // Эх үнэртэн (0159): хоосон шилэнд холбоос л — дотор нь үнэртэн байхгүй
  // тул ноот, тайлбар хамаагүй. Бүтэн / үлдэгдэлтэй шилэнд бүгд.
  // Breadcrumb (plan §19.1): Нүүр › Үнэртний шил › Хоосон шил › Нэр,
  // Нүүр › Дагалдах хэрэгсэл › Нэр (тэр хуудас ангиллаар хуваагддаггүй).
  const section = EXTRA_SECTION[extraSection(card)];
  const groupCrumb = kind
    ? {
        name: BOTTLE_KIND[kind].title,
        href: `${section.href}${kind === BOTTLE_TABS[0] ? "" : `?type=${kind}`}`,
      }
    : null;
  const perfume = extra.perfume;
  const scent =
    perfume && kind && kind !== "empty"
      ? {
          description: perfume.description,
          hasNotes:
            perfume.notesTop.length +
              perfume.notesHeart.length +
              perfume.notesBase.length >
            0,
        }
      : null;

  return (
    <div className="mx-auto max-w-352 p-4 sm:py-8 md:px-8">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Нүүр", path: "" },
            { name: section.title, path: section.href },
            { name: card.name, path: `/extras/${card.slug}` },
          ]),
        ]}
      />
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
              <Link href={section.href}>{section.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {groupCrumb && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={groupCrumb.href}>{groupCrumb.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{card.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Хувилбар сонгоход галерей тэр хувилбарын зураг руу (бэлгийн сав). */}
      <VariantImageProvider>
        <div className="grid grid-cols-1 gap-0 sm:gap-10 lg:grid-cols-2 lg:items-start">
          <div className="lg:sticky lg:top-(--header-offset) lg:self-start lg:transition-[top] lg:duration-300 lg:ease-out">
            {gallery.length > 0 ? (
              <ExtraGallery
                images={gallery.map((url) => ({ url, alt: card.name }))}
                name={card.name}
              />
            ) : (
              // Зураггүй бараа — desktop-д хоосон хар баганын оронд дүрс. Утсан
              // дээр нуугдана: агуулгыг дэлгэцээс доош түлхэхгүй.
              <div className="bg-secondary hidden aspect-square items-center justify-center rounded-2xl lg:flex">
                <Package
                  className="text-muted-foreground size-10"
                  aria-hidden
                />
              </div>
            )}
          </div>

          <div className="bg-background relative z-10 -mx-4 -mt-8 space-y-10 rounded-t-4xl px-4 pt-8 sm:mx-0 sm:mt-0 sm:rounded-none sm:bg-transparent sm:px-0 sm:pt-0">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 empty:hidden">
                  {!repeatsName(eyebrow, card.name) && (
                    <span className="text-muted-foreground text-sm tracking-wide uppercase">
                      {eyebrow}
                    </span>
                  )}
                  {leftover && !card.soldOut && (
                    <Badge variant="gold">Ганц ширхэг</Badge>
                  )}
                </div>
                <h1 className="font-serif text-3xl font-semibold tracking-tight">
                  {card.name}
                </h1>
                {leftover && (
                  <p className="text-muted-foreground text-sm tabular-nums">
                    ≈{leftover.remainingMl} / {leftover.fullMl}ml
                    {perMl != null && ` · 1ml ≈ ${formatPrice(perMl)}`}
                  </p>
                )}
                {size && (
                  <p className="text-muted-foreground text-sm tabular-nums">
                    Хэмжээ: {size}
                  </p>
                )}
              </div>

              <ExtraPurchase extra={extra} />

              {leftover && !card.soldOut && (
                <p className="bg-secondary rounded-lg px-4 py-3 text-sm">
                  Энэ бол декант цутгадаг эх шил өөрөө. Ганц ширхэг тул
                  захиалсан даруй хаагдана.
                </p>
              )}
              {perfume?.slug && (
                // Эх үнэртэн рүү — шилээ биш, грамаар (2–20ml) авах сонголт.
                <Link
                  href={`/products/${perfume.slug}`}
                  className="bg-secondary hover:bg-accent flex min-h-16 items-center gap-3 rounded-xl p-2 pr-4 transition-colors"
                >
                  <span className="bg-card relative size-12 shrink-0 overflow-hidden rounded-lg">
                    {card.image ? (
                      <Image
                        src={card.image}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <Package
                          className="text-muted-foreground size-5"
                          aria-hidden
                        />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Грамаар авах
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {perfume.brand} {perfume.name}
                    </span>
                  </span>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden
                  />
                </Link>
              )}
              <BottleList
                id="extra-other-bottles"
                title="Энэ үнэрийн бусад шил"
                bottles={otherBottles}
              />
            </div>

            {/* Энэ шил өөрөө (нөхцөл, хайрцаг) эхэнд — дараа нь доторх үнэр. */}
            {extra.description && (
              <div>
                <h2 className="mb-3 text-xl font-semibold">
                  {kind ? "Шилний тухай" : "Тайлбар"}
                </h2>
                <p className="text-muted-foreground text-sm/relaxed whitespace-pre-line">
                  {extra.description}
                </p>
              </div>
            )}

            {scent?.hasNotes && perfume && (
              <div>
                <h2 className="mb-4 font-serif text-xl font-semibold">
                  Үнэрийн нот
                </h2>
                <div className="bg-secondary grid grid-cols-1 gap-3 rounded-lg p-5 sm:grid-cols-3 sm:gap-4">
                  <NoteColumn title="Дээд" notes={perfume.notesTop} />
                  <NoteColumn title="Зүрх" notes={perfume.notesHeart} />
                  <NoteColumn title="Суурь" notes={perfume.notesBase} />
                </div>
              </div>
            )}

            {scent?.description && (
              <div>
                <h2 className="mb-3 font-serif text-xl font-semibold">
                  Үнэртний тухай
                </h2>
                <p className="text-muted-foreground text-sm/relaxed whitespace-pre-line">
                  {scent.description}
                </p>
              </div>
            )}

            <div>
              <h2 className="mb-3 font-serif text-xl font-semibold">Хүргэлт</h2>
              <p className="text-muted-foreground text-sm/relaxed">
                <DeliveryReturnsText />
              </p>
            </div>
          </div>
        </div>
      </VariantImageProvider>
    </div>
  );
}
