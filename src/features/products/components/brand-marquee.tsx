import Link from "next/link";
import Image from "next/image";

/**
 * Brand name → transparent logo file in /public/brands. Logos are dark artwork;
 * the `.brand-logo` class (globals.css) inverts them to white on the black
 * theme, and leaves them dark on the light themes. The Jo Malone art is only a
 * white-bg JPEG, so it intentionally falls back to a styled wordmark.
 */
const LOGOS: Record<string, string> = {
  "Acqua di Parma": "/brands/acqua-di-parma.svg",
  Chanel: "/brands/chanel.svg",
  Creed: "/brands/creed.svg",
  Dior: "/brands/dior.svg",
  "Maison Margiela": "/brands/maison-margiela.svg",
  "Tom Ford": "/brands/tom-ford.svg",
  "Yves Saint Laurent": "/brands/yves-saint-laurent.svg",
};

/**
 * Brand wall — two rows of brand logos scrolling in opposite directions.
 * Pure CSS marquee (uses the `animate-marquee` keyframe from globals.css, which
 * translates the track by -50%, so the track holds two identical halves).
 */
function Track({ items, reverse }: { items: string[]; reverse?: boolean }) {
  // 2× the items per half guarantees the half is wider than the viewport, and
  // the half is duplicated so -50% loops seamlessly.
  const half = [...items, ...items];
  const loop = [...half, ...half];
  return (
    <div
      className={`animate-marquee flex w-max items-center gap-10 pr-10 group-hover:[animation-play-state:paused] ${
        reverse ? "[animation-direction:reverse]" : ""
      }`}
    >
      {loop.map((b, i) => {
        const logo = LOGOS[b];
        return (
          <Link
            key={i}
            href={`/catalog?brand=${encodeURIComponent(b)}`}
            aria-hidden={i >= half.length}
            tabIndex={i >= half.length ? -1 : 0}
            aria-label={b}
            className="flex h-12 shrink-0 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
          >
            {logo ? (
              <span className="relative h-8 w-36 sm:h-9 sm:w-44">
                <Image
                  src={logo}
                  alt={b}
                  fill
                  unoptimized
                  sizes="176px"
                  className="brand-logo object-contain"
                />
              </span>
            ) : (
              <span className="font-serif text-xl font-semibold tracking-[0.18em] whitespace-nowrap uppercase sm:text-2xl">
                {b}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function BrandMarquee({ brands }: { brands: string[] }) {
  if (brands.length === 0) return null;
  const mid = Math.ceil(brands.length / 2);
  const row1 = brands.slice(0, mid);
  const row2 = brands.slice(mid);
  return (
    <div
      className="group relative space-y-6 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <Track items={row1} />
      <Track items={row2.length ? row2 : row1} reverse />
    </div>
  );
}
