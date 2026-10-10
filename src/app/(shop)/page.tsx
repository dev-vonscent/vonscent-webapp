import { Suspense } from "react";
import { preload } from "react-dom";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, ArrowRight, Quote } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { Stars } from "@/components/shared/stars";
import { ProductCarousel } from "@/features/products/components/product-carousel";
import { BrandMarquee } from "@/features/products/components/brand-marquee";
import {
  getNewArrivals,
  getBestSellers,
  getOnSale,
  getBrands,
} from "@/features/products/api";
import { getRecentReviews } from "@/features/reviews/api";
import {
  getPopupSettings,
  getHomeSections,
  getSocialSettings,
} from "@/features/content/api";
import {
  JsonLd,
  homePageJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/components/shared/json-ld";
import { pageMetadata } from "@/lib/seo";
import { getActiveBrands, getScentFamilies } from "@/features/taxonomy/api";
import {
  getBestSellerCollections,
  getNewestCollections,
} from "@/features/collections/api";
import { fillRail, interleave, mixRandom } from "@/features/products/rail";
import { ScentQuiz } from "@/features/quiz/components/scent-quiz";
import { DecantPlayground } from "@/features/marketing/components/decant-playground";
import { HeroPosterPreload } from "@/features/marketing/components/hero-poster-preload";
import { HERO_DEFAULT_ML } from "@/features/marketing/vial-specs";
import { PromoPopup } from "@/features/marketing/components/promo-popup";
import { firstPopupImage } from "@/features/marketing/popup-schedule";
import {
  GENDERS,
  GENDER_LABEL,
  HOT_COLLECTIONS_COUNT,
  NEW_COLLECTIONS_COUNT,
} from "@/lib/constants";
import { GRAIN } from "@/lib/textures";
import { SideImage } from "@/components/shared/side-image";
import {
  CarouselSkeleton,
  MarqueeSkeleton,
  ReviewsSkeleton,
  TileGridSkeleton,
} from "@/components/shared/skeletons";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

export const metadata: Metadata = pageMetadata("/");

/**
 * The page function itself is deliberately **not** async: nothing above blocks
 * on the database, so the hero, the trust strip and the static category grids
 * paint the instant the document arrives. Every data-backed rail is its own
 * async component behind a `<Suspense>` boundary and streams in under a
 * skeleton of its own shape.
 *
 * That is why each rail re-fetches what it needs instead of taking props from
 * one big `Promise.all`: the underlying readers (`fetchProducts`,
 * `fetchSettings`, `fetchScentFamilies`, `fetchBrands`, `getBaseCollections`)
 * are all wrapped in React `cache()`, so a request still makes each query once
 * — the boundaries only change *when* each result is allowed to paint, not how
 * many round-trips there are.
 */

export default function HomePage() {
  return (
    <>
      {/* An overlay with nothing to reserve, so it streams with no fallback. */}
      <Suspense fallback={null}>
        <PromoSlot />
      </Suspense>
      <Suspense fallback={null}>
        <SiteJsonLd />
      </Suspense>

      {/* Hero (туршилт: feat/hero-decant-visualizer) — хоёр тал.
          Зүүн: брэндийн текст + хэмжээ сонгогч + CTA (сонгосон хэмжээгээр
          каталог руу). Баруун: дэлгүүрийн 4 бодит decant савны 3D (Blender
          загвар, цалгидаг шингэн). Утсан дээр 3D дээрээ, текст доор нь.
          Сурталчилгааны зар (popup) өмнөх шигээ тусдаа popup-аар гарна. */}
      <section className="relative w-full overflow-hidden">
        <HeroPosterPreload ml={HERO_DEFAULT_ML} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
        <div className="relative mx-auto max-w-352 px-4 pt-4 pb-12 md:px-8 md:pt-8 lg:pb-16">
          <DecantPlayground
            intro={
              <div className="space-y-4">
                {/* Нүдэнд харагдахгүй, DOM-д (хайлт, дэлгэц уншигч) үлдэнэ. */}
                <p className="sr-only">Оригинал үнэртэн · Decant</p>
                <h1 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                  Бүтэн савтай үнэртэн авахаасаа өмнө туршаад үзээрэй
                </h1>
                <p className="sr-only">
                  Дэлхийн шилдэг үнэртнүүдийг 2/5/10/20 мл хэмжээгээр
                </p>
              </div>
            }
          />
        </div>
      </section>

      <div className="mx-auto max-w-352 space-y-10 px-4 py-8 sm:space-y-16 sm:py-14 md:px-8">
        {/* Дараалал: Эрэлттэй → Онцлох (админы rail-ууд) → Шинээр ирсэн
            (клиент, 2026-10). */}
        <Suspense fallback={<CarouselSkeleton action />}>
          <BestSellersSection />
        </Suspense>

        <QuizSection />

        <Suspense fallback={<CarouselSkeleton action />}>
          <CuratedSections />
        </Suspense>

        {/* Build-your-own bundle promo — the side image (5c) bleeds to the
            card edge and fades into the bg-card surface; a CSS glow stands
            in until public/bundle-side.webp is generated. */}
        <section className="force-black border-border bg-card relative grid grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-[320px_1fr]">
          <SideImage
            src="/bundle-side.webp"
            sizes="(max-width: 768px) 100vw, 320px"
            className="relative order-first aspect-5/2 min-h-70 w-full md:order-0 md:aspect-auto md:min-h-0"
            fallbackClassName="bg-[radial-gradient(ellipse_65%_70%_at_35%_55%,rgba(88,92,104,.45),rgba(40,42,50,.18)_55%,transparent_80%)]"
          >
            {/* fade into the card surface — md+ only; on mobile the image keeps
                its full-bleed edge (a vertical fade washed it out in light mode) */}
            <div className="from-card absolute inset-y-0 right-0 hidden w-1/2 bg-linear-to-l to-transparent md:block" />
          </SideImage>
          <div className="flex max-w-xl min-w-0 flex-col items-start justify-center gap-4 p-6 sm:p-10">
            <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
              Өөрийн багц
            </p>
            <h2 className="font-serif text-2xl font-semibold text-balance wrap-break-word sm:text-3xl">
              Дуртай үнэртнүүдээ багцал
            </h2>
            <p className="text-muted-foreground">
              4 ба түүнээс дээш үнэртэн сонгоод хямдралтай үнээр аваарай — Өөрт
              таалагдсан хослолоо хүссэнээрээ бүрдүүл
            </p>
            <Button asChild size="lg">
              <Link href="/collections/build">
                Багц үүсгэх <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <Suspense fallback={<CarouselSkeleton action />}>
          <NewArrivalsSection />
        </Suspense>

        {/* Shop by gender */}
        <section>
          <SectionHeading title="Хүйсээр" />
          <div className="grid grid-cols-3 gap-4">
            {GENDERS.map((g, i) => (
              <Link
                key={g}
                href={`/catalog?gender=${g}`}
                className="group bg-secondary hover:shadow-lift relative flex aspect-3/4 flex-col justify-end overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 sm:aspect-3/2"
              >
                {/* Mobile's 3:4 tile shows the full-body art too small, so it
                    uses the quiz's face-only 3:4 crop; sm+ keeps the 3:2 art. */}
                <Image
                  src={`/quiz/gender-${g}-face.webp`}
                  alt={GENDER_LABEL[g]}
                  fill
                  sizes="33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105 sm:hidden"
                />
                <Image
                  src={`/gender-${g}.webp`}
                  alt=""
                  fill
                  sizes="360px"
                  className="hidden object-cover object-top transition-transform duration-500 group-hover:scale-105 sm:block"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/15" />
                <span
                  aria-hidden
                  className="absolute top-4 right-4 z-10 font-serif text-3xl text-white/40"
                >
                  0{i + 1}
                </span>
                <span className="relative z-10 font-serif text-lg font-medium text-white sm:text-xl">
                  {GENDER_LABEL[g]}
                </span>
                <span className="relative z-10 mt-1 inline-flex items-center gap-1 text-xs text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                  Үзэх <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Suspense fallback={<TileGridSkeleton />}>
          <ScentFamiliesSection />
        </Suspense>

        {/* Shop by season */}
        <section>
          <SectionHeading title="Улирлаар" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { slug: "spring", label: "Хавар", ext: "jpg" },
              { slug: "summer", label: "Зун", ext: "jpg" },
              { slug: "autumn", label: "Намар", ext: "jpg" },
              { slug: "winter", label: "Өвөл", ext: "jpg" },
              { slug: "all", label: "Бүх улирал", ext: "webp" },
            ].map((s) => (
              <Link
                key={s.slug}
                href={`/catalog?season=${s.slug}`}
                className="group bg-secondary hover:shadow-lift relative flex aspect-3/2 items-end overflow-hidden rounded-2xl p-4 transition-all last:col-span-2 hover:-translate-y-1 sm:last:col-span-1"
              >
                <Image
                  src={`/season-${s.slug}.${s.ext}`}
                  alt={s.label}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/5" />
                <span className="relative z-10 font-serif text-lg font-medium text-white">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Suspense fallback={<MarqueeSkeleton />}>
          <BrandsSection />
        </Suspense>

        <Suspense fallback={<CarouselSkeleton action />}>
          <OnSaleSection />
        </Suspense>

        <Suspense fallback={<ReviewsSkeleton />}>
          <ReviewsSection />
        </Suspense>
      </div>
    </>
  );
}

async function SiteJsonLd() {
  const social = await getSocialSettings();
  return (
    <JsonLd
      data={[organizationJsonLd(social), websiteJsonLd(), homePageJsonLd()]}
    />
  );
}

async function PromoSlot() {
  const settings = await getPopupSettings();
  // Popup нээгдэхэд түүний зураг нүүрний LCP болдог (Sentry, prod 30 хоног:
  // p75 4.8с). Зураг нь hydration + effect-ийн дараа л татагдаж эхэлдэг байсан
  // тул HTML parse хийх үед JS-тэй зэрэг эхлүүлнэ. Priority-г өсгөхгүй —
  // popup-ийг нээх JS-тэй өрсөлдөх ёсгүй.
  const first = firstPopupImage(settings);
  if (first) preload(first, { as: "image" });
  return <PromoPopup settings={settings} />;
}

/**
 * Нүүрний rail бүрийн нүдний тоо. Багцын дээд тоо нь багцын автомат
 * «Шинэ»/«Эрэлттэй» тагийн тоо — rail дахь багц бүр тэр тагаа харуулна.
 */
const RAIL_SIZE = 12;

/**
 * Шинээр ирсэн = хамгийн сүүлийн ус ба багц (6 + 6, багц дутвал ус нөхнө),
 * санамсаргүй холилдоно. Нэг мөр дүүрэхгүй бол нуугдана (5d).
 */
async function NewArrivalsSection() {
  const [products, collections] = await Promise.all([
    getNewArrivals(RAIL_SIZE),
    getNewestCollections(NEW_COLLECTIONS_COUNT),
  ]);
  const rail = fillRail(
    products,
    collections,
    RAIL_SIZE,
    NEW_COLLECTIONS_COUNT,
  );
  const items = mixRandom(rail.products, rail.collections);
  if (items.length < 4) return null;
  return (
    <section>
      <SectionHeading title="Шинээр ирсэн" href="/catalog?tags=new&sort=new" />
      <ProductCarousel items={items} prefer={["new"]} />
    </section>
  );
}

/**
 * Scent quiz — for visitors who can't pick. Entirely client-side (so the ISR
 * page stays cacheable) and no longer fetches anything on the server, so it
 * needs no Suspense boundary: matching runs in /api/quiz on demand.
 */
function QuizSection() {
  return (
    <section>
      <ScentQuiz />
    </section>
  );
}

/**
 * Эрэлттэй = ус, багц тус тусдаа борлуулалтаар эрэмбэлэгдэж (6 + 6, багц
 * дутвал ус нөхнө — 3 багц бол 9 ус), эрэмбээрээ ээлжилнэ.
 */
async function BestSellersSection() {
  const [products, collections] = await Promise.all([
    getBestSellers(RAIL_SIZE),
    getBestSellerCollections(HOT_COLLECTIONS_COUNT),
  ]);
  const rail = fillRail(
    products,
    collections,
    RAIL_SIZE,
    HOT_COLLECTIONS_COUNT,
  );
  return (
    <section>
      <SectionHeading title="Эрэлттэй" href="/catalog?tags=hot" />
      <ProductCarousel
        items={interleave(rail.products, rail.collections)}
        prefer={["hot"]}
      />
    </section>
  );
}

/**
 * Curated rails — «Онцлох» and the other rails the admin arranged
 * (todo.md B7), in the order they set. They share one boundary because they are
 * one query and their count isn't known until it resolves.
 */
async function CuratedSections() {
  const sections = await getHomeSections();
  return (
    <>
      {sections.map((s) => {
        // Хэсгийн төлөв card бүр дээр: «Онцлох» дотор «Онцлох».
        const prefer = s.status ? [s.status] : undefined;
        return (
          <section key={s.id}>
            <SectionHeading title={s.title} href={s.href || undefined} />
            {/* «Онцлох» (featured) хэсэгт онцлох багцууд усуудтай
              санамсаргүй холилдоно; бусад хэсэг админы дарааллаараа. */}
            {s.collections.length > 0 ? (
              <ProductCarousel
                items={mixRandom(s.products, s.collections)}
                prefer={prefer}
              />
            ) : (
              <ProductCarousel products={s.products} prefer={prefer} />
            )}
          </section>
        );
      })}
    </>
  );
}

/**
 * Shop by scent family — the admin-managed taxonomy, icons included
 * (todo.md B3b), so a family added in the admin shows up here too.
 */
async function ScentFamiliesSection() {
  const families = await getScentFamilies();
  if (families.length === 0) return null;
  return (
    <section>
      <SectionHeading title="Үнэрийн төрлөөр" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {families.map((f) => (
          <Link
            key={f.slug}
            href={`/catalog?family=${f.slug}`}
            className="group bg-card hover:bg-accent hover:shadow-soft flex flex-col items-center gap-2 rounded-xl p-4 text-center text-xs font-medium transition-all hover:-translate-y-1"
          >
            <div className="relative size-16 transition-transform duration-500 group-hover:scale-105">
              {f.iconUrl ? (
                <Image
                  src={f.iconUrl}
                  alt={f.label}
                  fill
                  sizes="64px"
                  // The 256px WebP master is only a few KB; optimizing it
                  // would cost a transformation without shrinking much.
                  unoptimized
                  className="object-contain"
                />
              ) : (
                // No icon uploaded yet: the initial keeps the grid even.
                <span className="bg-secondary flex size-full items-center justify-center rounded-full font-serif text-xl">
                  {f.label.slice(0, 1)}
                </span>
              )}
            </div>
            {f.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

async function BrandsSection() {
  const [brands, brandLogos] = await Promise.all([
    getBrands(),
    getActiveBrands(),
  ]);
  return (
    <section>
      <SectionHeading title="Брэндээр" href="/catalog" />
      <BrandMarquee
        brands={brands}
        logos={Object.fromEntries(brandLogos.map((b) => [b.name, b.logoUrl]))}
      />
    </section>
  );
}

async function OnSaleSection() {
  const onSale = await getOnSale(4);
  if (onSale.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Онцгой санал"
        subtitle="Хямдралтай үнэртнүүд"
        href="/catalog?tags=sale"
      />
      <ProductCarousel products={onSale} />
    </section>
  );
}

async function ReviewsSection() {
  const reviews = await getRecentReviews(3);
  if (reviews.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Хэрэглэгчдийн сэтгэгдэл"
        subtitle="Бодит худалдан авагчдын үнэлгээ"
      />
      <div className="grid gap-5 md:grid-cols-3">
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="group border-border bg-card hover:border-gold-strong/40 hover:shadow-lift relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 transition-all duration-300"
          >
            <Quote
              className="text-foreground/4 group-hover:text-gold-strong/10 pointer-events-none absolute -top-3 -right-3 size-20 rotate-180 transition-colors"
              strokeWidth={1.5}
              aria-hidden
            />
            <Stars rating={r.rating} size={16} />
            <blockquote className="text-foreground/90 line-clamp-5 font-serif text-[15px] leading-relaxed">
              “{r.body || "Сайхан үнэр!"}”
            </blockquote>
            <figcaption className="border-border/60 mt-auto flex items-center gap-3 border-t pt-4">
              <span className="bg-secondary relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold">
                {r.authorAvatar ? (
                  <Image
                    src={r.authorAvatar}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  r.authorName.charAt(0).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-foreground truncate text-sm font-medium">
                    {r.authorName}
                  </span>
                  <BadgeCheck
                    className="text-gold-strong size-3.5 shrink-0"
                    aria-label="Баталгаажсан худалдан авагч"
                  />
                </div>
                <span className="text-muted-foreground block text-xs">
                  {formatDate(r.createdAt)}
                </span>
              </div>
              {r.productName && (
                <Link
                  href={`/products/${r.productSlug}`}
                  className="group/prod flex items-center gap-2"
                  title={`${r.brand} ${r.productName}`}
                >
                  <span className="border-border bg-muted group-hover/prod:border-gold-strong/50 relative size-15 shrink-0 overflow-hidden rounded-lg border transition-colors">
                    {r.productImage ? (
                      <Image
                        src={r.productImage}
                        alt={r.productName}
                        fill
                        sizes="60px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground flex h-full items-center justify-center text-[10px] font-medium">
                        {r.brand.charAt(0)}
                      </span>
                    )}
                  </span>
                </Link>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
