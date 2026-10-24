import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { preload } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBaseCollections } from "@/features/collections/api";
import {
  EVERGREEN_HERO,
  liveCampaigns,
  type HomeCampaign,
} from "../../home-content";

interface HeroImage {
  src: string;
  alt: string;
  position: string;
  width?: number;
  height?: number;
  /** Бэлэн desktop srcset — Next optimizer-ыг алгасна. */
  srcSet?: string;
  /** Утасны (< sm) art-directed зураг. */
  mobile?: { src: string; width: number; height: number };
}

interface ResolvedHero {
  campaign: HomeCampaign;
  image: HeroImage;
}

/**
 * The first live campaign whose image actually resolves — a campaign that
 * points at a deleted/hidden bundle falls through to the next one, and in the
 * end to the evergreen hero, so the slot is never empty or broken.
 */
export async function resolveHero(now = new Date()): Promise<ResolvedHero> {
  const candidates = [...liveCampaigns(now), EVERGREEN_HERO];
  let collections: Awaited<ReturnType<typeof getBaseCollections>> | null = null;
  for (const campaign of candidates) {
    const img = campaign.image;
    if (img.kind === "static") return staticHero(campaign, img);
    collections ??= await getBaseCollections();
    const found = collections.find((c) => c.slug === img.slug);
    if (found?.image) {
      return {
        campaign,
        image: {
          src: found.image,
          alt: img.alt,
          position: img.position ?? "50% 50%",
        },
      };
    }
  }
  // EVERGREEN_HERO is static, so the loop always returns — this satisfies TS.
  throw new Error("unreachable: evergreen hero must be static");
}

/**
 * The hero without any data fetch, when the first candidate is a static
 * photo; `null` when it needs a bundle cover (then `resolveHero`).
 *
 * The page renders this hero outside its own `<Suspense>`: a nested boundary
 * is revealed by React's batched `$RC` (rAF + 300ms steps), which a busy
 * phone main thread pushes past hydration — Lighthouse mobile LCP was ~11s
 * with the image itself downloaded in 0.3s.
 */
export function resolveStaticHero(now = new Date()): ResolvedHero | null {
  const campaign = liveCampaigns(now)[0] ?? EVERGREEN_HERO;
  const img = campaign.image;
  return img.kind === "static" ? staticHero(campaign, img) : null;
}

function staticHero(
  campaign: HomeCampaign,
  img: Extract<HomeCampaign["image"], { kind: "static" }>,
): ResolvedHero {
  return {
    campaign,
    image: {
      src: img.src,
      alt: img.alt,
      position: img.position ?? "50% 50%",
      width: img.width,
      height: img.height,
      srcSet: img.srcSet,
      mobile: img.mobile,
    },
  };
}

/** Same breakpoint as Tailwind `sm` — the photo and the layout switch together. */
const DESKTOP_MEDIA = "(min-width: 640px)";
const MOBILE_MEDIA = "(max-width: 639.98px)";

/**
 * Seasonal hero. With an art-directed photo (`image.mobile`) the photograph
 * fills the whole card and the copy sits on its empty wall — left half on
 * sm+, top of the frame on a phone. Without one it falls back to the split
 * layout (text left, image right). Static: no carousel, no video, no 3D. The
 * image is the page's LCP candidate, hence `priority` / eager loading.
 */
export function CampaignHero({ hero }: { hero: ResolvedHero }) {
  return hero.image.mobile ? (
    <PhotoHero hero={hero} mobile={hero.image.mobile} />
  ) : (
    <SplitHero hero={hero} />
  );
}

function HeroCopy({
  campaign,
  tone,
}: {
  campaign: HomeCampaign;
  tone: "theme" | "photo";
}) {
  // On the photo the wall is light beige in every theme, so the copy is
  // pinned to dark neutrals instead of following theme tokens.
  const muted = tone === "photo" ? "text-neutral-700" : "text-muted-foreground";
  return (
    <>
      <p className={`${muted} text-xs font-medium sm:text-sm`}>
        {campaign.eyebrow}
      </p>
      <h1
        id="home-hero-title"
        className={`text-[clamp(1.125rem,5.6vw,1.375rem)]/[1.15] font-bold tracking-tight text-balance sm:text-2xl md:text-3xl lg:text-[2.75rem]/[1.1] ${
          tone === "photo" ? "text-neutral-950" : ""
        }`}
      >
        {campaign.title}
      </h1>
      <p className={`${muted} hidden max-w-md text-base md:block`}>
        {campaign.description}
      </p>
      {/* 380px-ээс нарийн утсан дээр 4:3 картанд гарчиг + товч л багтана. */}
      <p className={`${muted} text-sm max-[380px]:hidden md:hidden`}>
        {campaign.mobileDescription ?? campaign.description}
      </p>
      {/* Утсан дээрх гэрэл зурган hero-д товч картын зүүн доод буланд
          (`mt-auto`) — эрхий хуруунд ойр, гарчгийн уртаас үл хамаарна. */}
      <div
        className={`flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-3 ${
          tone === "photo" ? "mt-auto pt-2" : "mt-2"
        }`}
      >
        {/* Гэрэл зураг дээр ч theme-ийн primary — хоёр theme-д (black/white)
            хоёуланд нь бараан тул шаргал хана дээр тод уншигдана. */}
        <Button asChild className="h-11 px-4 sm:px-6">
          <Link href={campaign.primary.href}>
            {campaign.primary.label} <ArrowRight className="size-4" />
          </Link>
        </Button>
        {campaign.secondary && (
          <Button
            asChild
            variant="outline"
            className={`hidden h-11 px-6 md:inline-flex ${
              tone === "photo"
                ? "border-neutral-950/15 bg-white/70 text-neutral-950 backdrop-blur hover:bg-white hover:text-neutral-950"
                : ""
            }`}
          >
            <Link href={campaign.secondary.href}>
              {campaign.secondary.label}
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}

function PhotoHero({
  hero,
  mobile,
}: {
  hero: ResolvedHero;
  mobile: NonNullable<HeroImage["mobile"]>;
}) {
  const { campaign, image } = hero;
  // `next.config` зөвхөн quality 75-ыг зөвшөөрдөг (өөр утга 75 руу буудаг).
  const common = { alt: image.alt, priority: true };
  // Карт `max-w-420` (1680px) дотор `md:px-8` → хамгийн ихдээ 1616px.
  const desktopSizes = "(min-width: 1680px) 1616px, 100vw";
  const desktopSrcSet =
    image.srcSet ??
    getImageProps({
      ...common,
      src: image.src,
      width: image.width ?? 1600,
      height: image.height ?? 571,
      sizes: desktopSizes,
    }).props.srcSet;
  const { props: mobileProps } = getImageProps({
    ...common,
    src: mobile.src,
    width: mobile.width,
    height: mobile.height,
    sizes: "100vw",
  });
  // Next 16-д `priority` нь getImageProps-оор fetchpriority тавихгүй, React
  // ч `<picture>` доторх зургийг өөрөө preload хийдэггүй — энэ hero нь LCP
  // тул хоёр хувилбарыг `media`-тай нь preload хийнэ (браузер нэгийг л татна).
  preload(mobileProps.src, {
    as: "image",
    imageSrcSet: mobileProps.srcSet,
    imageSizes: "100vw",
    media: MOBILE_MEDIA,
    fetchPriority: "high",
  });
  if (desktopSrcSet)
    preload(image.src, {
      as: "image",
      imageSrcSet: desktopSrcSet,
      imageSizes: desktopSizes,
      media: DESKTOP_MEDIA,
      fetchPriority: "high",
    });

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate flex aspect-4/3 min-h-64 w-full overflow-hidden rounded-2xl bg-[#e8dccd] sm:aspect-14/5 sm:max-h-[58svh] sm:min-h-64 md:min-h-80 lg:min-h-88"
    >
      {/* Art direction: next/image can't switch files per breakpoint, so the
          two optimized srcsets go into a <picture>. On sm–md the card is taller
          than the 2.8:1 photo, so it crops sideways — 65% keeps the products'
          right edge and trims the empty wall instead (prompts/hero-desktop.md). */}
      <picture>
        <source
          media={DESKTOP_MEDIA}
          srcSet={desktopSrcSet}
          sizes={desktopSizes}
        />
        <img
          {...mobileProps}
          alt={image.alt}
          fetchPriority="high"
          className="absolute inset-0 -z-10 size-full object-cover object-right sm:object-[65%_50%]"
        />
      </picture>
      {/* Утас: 4:3 намхан карт (дэлгэцийн ~⅓) — бичиг зүүн 62%-д, бараа
          баруун талд, товч зүүн доод буланд. Desktop-той ижил «зүүн талд
          хоосон хана» зохиомж, тиймээс зураг нь ч мөн адил: prompts/hero-mobile.md. */}
      <div className="flex w-[62%] flex-col justify-start gap-1.5 p-4 sm:w-[52%] sm:justify-center sm:gap-3 sm:p-8 md:p-10 lg:px-14">
        <HeroCopy campaign={campaign} tone="photo" />
      </div>
    </section>
  );
}

function SplitHero({ hero }: { hero: ResolvedHero }) {
  const { campaign, image } = hero;
  return (
    <section
      aria-labelledby="home-hero-title"
      className="bg-secondary grid min-h-48 grid-cols-[minmax(0,1fr)_40%] overflow-hidden rounded-2xl sm:min-h-64 md:min-h-80 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:min-h-88"
    >
      <div className="flex flex-col justify-center gap-2 p-4 sm:gap-3 sm:p-8 md:p-10 lg:px-14">
        <HeroCopy campaign={campaign} tone="theme" />
      </div>
      <div className="bg-muted relative">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="(max-width: 768px) 40vw, (max-width: 1408px) 52vw, 740px"
          className="object-cover"
          style={{ objectPosition: image.position }}
        />
      </div>
    </section>
  );
}
