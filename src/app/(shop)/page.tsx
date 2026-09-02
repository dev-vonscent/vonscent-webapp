import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ShieldCheck,
  Truck,
  BadgeCheck,
  ArrowRight,
  Quote,
} from "lucide-react";
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
import { getPopupSettings, getHomeSections } from "@/features/content/api";
import { getActiveBrands, getScentFamilies } from "@/features/taxonomy/api";
import { getFeaturedCollections } from "@/features/collections/api";
import { CollectionCard } from "@/features/collections/components/collection-card";
import { ScentQuiz } from "@/features/quiz/components/scent-quiz";
import { PromoPopup } from "@/features/marketing/components/promo-popup";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";
import { GRAIN } from "@/lib/textures";
import { SideImage } from "@/components/shared/side-image";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

const TRUST = [
  { icon: BadgeCheck, title: "100% жинхэнэ", desc: "Албан ёсны эх сурвалж" },
  { icon: Sparkles, title: "2/5/10/20ml", desc: "Туршиж сонгох багц" },
  { icon: Truck, title: "Шуурхай хүргэлт", desc: "Хотод 24 цагт" },
  { icon: ShieldCheck, title: "Аюулгүй төлбөр", desc: "QPay & банк" },
];

export default async function HomePage() {
  const [
    newArrivals,
    bestSellers,
    onSale,
    brands,
    reviews,
    popup,
    families,
    brandLogos,
    sections,
    featuredCollections,
  ] = await Promise.all([
    getNewArrivals(8),
    getBestSellers(8),
    getOnSale(4),
    getBrands(),
    getRecentReviews(3),
    getPopupSettings(),
    getScentFamilies(),
    getActiveBrands(),
    getHomeSections(),
    getFeaturedCollections(3),
  ]);

  return (
    <>
      <PromoPopup settings={popup} />
      {/* Hero — a contained (never upscaled) image over the flat theme
          backdrop, so the artwork stays sharp on wide screens. Pulled up under
          the floating header (pt-4 16px + h-14 pill = 72px) so the backdrop
          reaches the very top and shows behind the translucent pill. */}
      <section className="bg-background relative -mt-18 w-full overflow-hidden">
        {/* No CSS ambience behind the artwork — the backdrop stays the flat
            theme background so the bottle's own lighting is the only glow. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
        <div className="mx-auto grid max-w-352 items-center gap-8 px-4 pt-28 pb-16 md:grid-cols-2 md:px-8">
          <div className="relative z-10 max-w-xl space-y-6 max-md:mx-auto max-md:flex max-md:flex-col max-md:items-center max-md:text-center md:order-1">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.22em] uppercase sm:text-sm">
              Жинхэнэ үнэртэн · Decant
            </p>
            <h1 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Бүтэн үнэртэн авахаасаа өмнө туршиж үз
            </h1>
            <p className="text-muted-foreground text-base text-pretty sm:text-lg">
              Дэлхийн шилдэг үнэртнүүдийг 2/5/10/20ml сонголтоор — өөрт
              тохирох үнэртэй усаа олоод дараа нь бүтнээр нь аваарай.
            </p>
            <div className="flex gap-3">
              <Button
                asChild
                size="lg"
                className="in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
              >
                <Link href="/catalog">Каталог үзэх</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="in-[.black]:bg-white/10 in-[.black]:text-white in-[.black]:hover:bg-white/20"
              >
                <Link href="/collections/build">Багц угсрах</Link>
              </Button>
            </div>
          </div>

          {/* The image never scales past its container, and the mask melts
              its edges into the CSS backdrop. */}
          <div className="relative order-first mx-auto aspect-square w-full max-w-140 mask-[radial-gradient(ellipse_70%_68%_at_50%_50%,#000_55%,transparent_78%)] md:order-2">
            {/* One artwork per theme — the dark shot is unreadable on the
                light palettes. All three are in the DOM (a display:none
                image is never "visible", so lazy-loading would never fire
                it); only the active theme's is painted. */}
            <Image
              src="/hero-black.webp"
              alt="VON SCENT"
              fill
              priority
              // All three artworks are square — 1:1 with the slot.
              sizes="(max-width: 768px) 100vw, 560px"
              // The bottle sits smaller in its frame than the light shots,
              // so it gets a nudge up in scale to match their presence.
              className="scale-110 object-cover in-[.pink]:hidden in-[.white]:hidden"
            />
            <Image
              src="/hero-white.webp"
              alt="VON SCENT"
              fill
              loading="eager"
              sizes="(max-width: 768px) 100vw, 560px"
              className="hidden object-cover in-[.white]:block"
            />
            <Image
              src="/hero-pink.webp"
              alt="VON SCENT"
              fill
              loading="eager"
              sizes="(max-width: 768px) 100vw, 560px"
              className="hidden object-cover in-[.pink]:block"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-352 space-y-10 px-4 py-8 sm:space-y-16 sm:py-14 md:px-8">
        {/* Trust */}
        <section className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="bg-card flex items-center gap-3 p-5">
              <t.icon className="text-gold-strong size-6 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-muted-foreground text-xs">{t.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* New arrivals — hidden until it can fill a row (5d). */}
        {newArrivals.length >= 4 && (
          <section>
            <SectionHeading title="Шинээр буусан" href="/catalog?tags=new" />
            <ProductCarousel products={newArrivals} />
          </section>
        )}

        {/* Scent quiz — for visitors who can't pick (client-only, so the ISR
          page stays cacheable; matching runs in /api/quiz on demand). */}
        <section>
          <ScentQuiz families={families} />
        </section>

        {/* Best sellers */}
        <section>
          <SectionHeading title="Эрэлттэй" href="/catalog?tags=hot" />
          <ProductCarousel products={bestSellers} />
        </section>

        {/* Featured bundles */}
        {featuredCollections.length > 0 && (
          <section>
            <SectionHeading
              title="Онцлох багц"
              subtitle="Сонгож бэлдсэн үнэртний багцууд"
              href="/collections"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {featuredCollections.map((c) => (
                <CollectionCard key={c.id} collection={c} />
              ))}
            </div>
          </section>
        )}

        {/* Build-your-own bundle promo — the side image (5c) bleeds to the
            card edge and fades into the bg-card surface; a CSS glow stands
            in until public/bundle-side-v2.webp is generated. */}
        <section className="border-border bg-card relative grid grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-[320px_1fr]">
          <SideImage
            src="/bundle-side-v2.webp"
            sizes="(max-width: 768px) 100vw, 320px"
            className="relative order-first aspect-5/2 min-h-70 w-full md:order-0 md:aspect-auto md:min-h-0"
            fallbackClassName="bg-[radial-gradient(ellipse_65%_70%_at_35%_55%,rgba(88,92,104,.45),rgba(40,42,50,.18)_55%,transparent_80%)]"
          >
            {/* fade into the card surface: upward on mobile, rightward on md+ */}
            <div className="from-card absolute inset-x-0 bottom-0 h-[60%] bg-linear-to-t to-transparent md:hidden" />
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
              4 ба түүнээс дээш үнэртэн сонгоод хямдралтай үнээр аваарай — дээр
              нь өөрийн сонгосон нэмэлт бэлэгтэй.
            </p>
            <Button asChild size="lg">
              <Link href="/collections/build">
                Багц угсарч эхлэх <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Curated sections — «Онцлох», «Багц уснууд» and anything else the
          admin composed (todo.md B7), in the order they set. */}
        {sections.map((s) => (
          <section key={s.id}>
            <SectionHeading
              title={s.title}
              subtitle={s.subtitle || undefined}
              href={s.href || undefined}
            />
            <ProductCarousel products={s.products} />
          </section>
        ))}

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
                <Image
                  src={`/gender-${g}.webp`}
                  alt={GENDER_LABEL[g]}
                  fill
                  sizes="(max-width: 640px) 33vw, 360px"
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
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

        {/* Shop by scent family — the admin-managed taxonomy, icons included
          (todo.md B3b), so a family added in the admin shows up here too. */}
        {families.length > 0 && (
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
        )}

        {/* Shop by season */}
        <section>
          <SectionHeading title="Улирлаар" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { slug: "spring", label: "Хавар" },
              { slug: "summer", label: "Зун" },
              { slug: "autumn", label: "Намар" },
              { slug: "winter", label: "Өвөл" },
            ].map((s) => (
              <Link
                key={s.slug}
                href={`/catalog?season=${s.slug}`}
                className="group bg-secondary hover:shadow-lift relative flex aspect-3/2 items-end overflow-hidden rounded-2xl p-4 transition-all hover:-translate-y-1"
              >
                <Image
                  src={`/season-${s.slug}.jpg`}
                  alt={s.label}
                  fill
                  sizes="(max-width: 640px) 50vw, 280px"
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

        {/* Brands */}
        <section>
          <SectionHeading title="Брэндээр" href="/catalog" />
          <BrandMarquee
            brands={brands}
            logos={Object.fromEntries(
              brandLogos.map((b) => [b.name, b.logoUrl]),
            )}
          />
        </section>

        {/* On sale */}
        {onSale.length > 0 && (
          <section>
            <SectionHeading
              title="Онцгой санал"
              subtitle="Хямдралтай үнэртнүүд"
              href="/catalog?tags=sale"
            />
            <ProductCarousel products={onSale} />
          </section>
        )}

        {/* Brand intro — statless (5d): the counts looked hollow on a small
            catalogue and the generic claims already live in the trust bar. */}
        <section className="border-border rounded-xl border p-8 md:p-12">
          <div className="max-w-2xl space-y-4">
            <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
              Бидний тухай
            </p>
            <h2 className="font-serif text-3xl font-semibold">
              Үнэр бол хувийн илэрхийлэл
            </h2>
            <p className="text-muted-foreground">
              vonscent нь дэлхийн шилдэг үнэртнүүдийг жижиг (decant) багцаар
              санал болгодог. Бүтэн сав авахаасаа өмнө өөрт тань яг тохирохыг
              туршиж олох боломжийг бид олгоно.
            </p>
            <Button asChild variant="outline">
              <Link href="/about">Дэлгэрэнгүй</Link>
            </Button>
          </div>
        </section>

        {/* Reviews */}
        {reviews.length > 0 && (
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
        )}
      </div>
    </>
  );
}
