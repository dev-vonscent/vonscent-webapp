import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ShieldCheck,
  Truck,
  BadgeCheck,
  Instagram,
  ArrowRight,
  Quote,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/shared/site-footer";
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
  getSocialSettings,
  getHeroBanners,
  getHomeSections,
} from "@/features/content/api";
import { getScentFamilies } from "@/features/taxonomy/api";
import { HeroCarousel } from "@/features/marketing/components/hero-carousel";
import { PromoPopup } from "@/features/marketing/components/promo-popup";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";

const TRUST = [
  { icon: BadgeCheck, title: "100% жинхэнэ", desc: "Албан ёсны эх сурвалж" },
  { icon: Sparkles, title: "5/10/20ml", desc: "Туршиж сонгох багц" },
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
    social,
    banners,
    families,
    sections,
  ] = await Promise.all([
    getNewArrivals(8),
    getBestSellers(8),
    getOnSale(4),
    getBrands(),
    getRecentReviews(3),
    getPopupSettings(),
    getSocialSettings(),
    getHeroBanners(),
    getScentFamilies(),
    getHomeSections(),
  ]);

  return (
    <>
      <PromoPopup settings={popup} />
      {/* Hero — responsive art direction: 1:1 on phones, 21:9 on larger screens.
          Pulled up under the floating header (pt-4 16px + h-14 pill = 72px) so
          the image reaches the very top and shows behind the translucent pill. */}
      <section className="relative -mt-[72px] aspect-square w-full overflow-hidden bg-black sm:aspect-[21/9]">
        {banners.length > 0 ? (
          // Admin-managed banners (A8) win; the static pair below is the
          // fallback for a store that hasn't uploaded any yet.
          <HeroCarousel banners={banners} />
        ) : (
          <>
            <Image
              src="/hero-mobile.jpg"
              alt="VON SCENT"
              fill
              priority
              sizes="100vw"
              className="object-cover sm:hidden"
            />
            <Image
              src="/hero-desktop.jpg"
              alt="VON SCENT"
              fill
              priority
              sizes="100vw"
              className="hidden object-cover sm:block"
            />
          </>
        )}
      </section>

      <div className="mx-auto max-w-[88rem] space-y-10 px-4 md:px-8 py-8 sm:space-y-16 sm:py-14">
      {/* Trust */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {TRUST.map((t) => (
          <div
            key={t.title}
            className="flex items-center gap-3 bg-card p-5"
          >
            <t.icon className="size-6 shrink-0 text-gold-strong" />
            <div>
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* New arrivals */}
      <section>
        <SectionHeading
          title="Шинээр буусан"
          href="/catalog?tags=new"
        />
        <ProductCarousel products={newArrivals} />
      </section>

      {/* Best sellers */}
      <section>
        <SectionHeading
          title="Эрэлттэй"
          href="/catalog?tags=hot"
        />
        <ProductCarousel products={bestSellers} />
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
              className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl bg-secondary p-5 transition-all hover:-translate-y-1 hover:shadow-lift sm:aspect-[3/2]"
            >
              <Image
                src={`/gender-${g}.png`}
                alt={GENDER_LABEL[g]}
                fill
                sizes="(max-width: 640px) 33vw, 360px"
                className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
              <span className="absolute right-4 top-4 z-10 font-serif text-3xl text-white/40">
                0{i + 1}
              </span>
              <span className="relative z-10 font-serif text-lg font-medium sm:text-xl">
                {GENDER_LABEL[g]}
              </span>
              <span className="relative z-10 mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                Үзэх <ArrowRight className="size-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

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
              className="group relative flex aspect-3/2 items-end overflow-hidden rounded-2xl bg-secondary p-4 transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <Image
                src={`/season-${s.slug}.jpg`}
                alt={s.label}
                fill
                sizes="(max-width: 640px) 50vw, 280px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <span className="relative z-10 font-serif text-lg font-medium text-white">
                {s.label}
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
                className="group flex flex-col items-center gap-2 rounded-xl bg-card p-4 text-center text-xs font-medium transition-all hover:-translate-y-1 hover:bg-accent hover:shadow-soft"
              >
                <div className="relative size-16 transition-transform duration-500 group-hover:scale-105">
                  {f.iconUrl ? (
                    <Image
                      src={f.iconUrl}
                      alt={f.label}
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  ) : (
                    // No icon uploaded yet: the initial keeps the grid even.
                    <span className="flex size-full items-center justify-center rounded-full bg-secondary font-serif text-xl">
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

      {/* Brands */}
      <section>
        <SectionHeading title="Брэндээр" href="/catalog" />
        <BrandMarquee brands={brands} />
      </section>

      {/* Small-size CTA */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-deep px-6 py-12 shadow-lift sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute inset-4 rounded-xl border border-gold-strong/20" />
        <div className="relative max-w-lg space-y-4">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">
            ✦ 5мл багц
          </span>
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            Багахнаар туршиж эхлээрэй
          </h2>
          <p className="text-muted-foreground">
            Аль үнэр тань илүү таалагдахаа мэдэхгүй байна уу? 5мл багцаар хэд
            хэдийг үнэрлээд дуртайгаа сонгоорой.
          </p>
          <Button asChild size="lg">
            <Link href="/catalog?ml=5">5мл сонгох</Link>
          </Button>
        </div>
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

      {/* Brand intro */}
      <section className="grid items-center gap-8 rounded-xl border border-border p-8 md:grid-cols-2 md:p-12">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Бидний тухай
          </p>
          <h2 className="font-serif text-3xl font-semibold">
            Үнэр бол хувийн илэрхийлэл
          </h2>
          <p className="text-muted-foreground">
            vonscent нь дэлхийн шилдэг үнэртнүүдийг жижиг (decant) багцаар санал
            болгодог. Бүтэн сав авахаасаа өмнө өөрт тань яг тохирохыг туршиж
            олох боломжийг бид олгоно.
          </p>
          <Button asChild variant="outline">
            <Link href="/about">Дэлгэрэнгүй</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { v: "100%", l: "Жинхэнэ бараа" },
            { v: "5/10/20ml", l: "Туршиж сонгох" },
            { v: "24ц", l: "Хотод хүргэлт" },
            { v: "QPay", l: "Аюулгүй төлбөр" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-lg border border-border bg-secondary p-5 text-center"
            >
              <p className="font-serif text-2xl font-semibold">{s.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
            </div>
          ))}
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
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-gold-strong/40 hover:shadow-lift"
              >
                <Quote
                  className="pointer-events-none absolute -right-3 -top-3 size-20 rotate-180 text-foreground/4 transition-colors group-hover:text-gold-strong/10"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <Stars rating={r.rating} size={16} />
                <blockquote className="font-serif text-[15px] leading-relaxed text-foreground/90 line-clamp-5">
                  “{r.body || "Сайхан үнэр!"}”
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3 border-t border-border/60 pt-4">
                  <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold">
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
                      <span className="truncate text-sm font-medium text-foreground">
                        {r.authorName}
                      </span>
                      <BadgeCheck
                        className="size-3.5 shrink-0 text-gold-strong"
                        aria-label="Баталгаажсан худалдан авагч"
                      />
                    </div>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  {r.productName && (
                    <Link
                      href={`/products/${r.productSlug}`}
                      className="group/prod flex items-center gap-2"
                      title={`${r.brand} ${r.productName}`}
                    >
                      <span className="relative size-15 shrink-0 overflow-hidden rounded-lg border border-border bg-muted transition-colors group-hover/prod:border-gold-strong/50">
                        {r.productImage ? (
                          <Image
                            src={r.productImage}
                            alt={r.productName}
                            fill
                            sizes="60px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[10px] font-medium text-muted-foreground">
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

      {/* Instagram / social */}
      {social.instagram && (
        <section>
          <SectionHeading title="Instagram" subtitle="@vonscent.mn" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <a
                key={i}
                href={social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:text-primary"
              >
                <Instagram className="size-6 transition-transform group-hover:scale-110" />
              </a>
            ))}
          </div>
        </section>
      )}
      </div>

      <SiteFooter />
    </>
  );
}
