import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import {
  imageAspect,
  tintMask,
  toJpegCover,
  toOgPhoto,
} from "@/lib/storage/process-image";

/**
 * Share cards for the per-page dynamic `opengraph-image.tsx` routes. The
 * site-wide card is a static file — see `SITE.ogImage`.
 *
 * The card never repeats what the preview already prints under it: no
 * product/collection name (og:title), no domain (Messenger/Telegram show
 * it). It carries the brand mark once and the thing a title can't — the
 * per-size prices, or the collection's own photo.
 *
 * next/og (satori) ships only a latin Inter subset, so Cyrillic text would
 * render as tofu — we fetch a per-request Google-Fonts subset containing
 * exactly the glyphs used. satori can't decode WebP (every upload is WebP),
 * so photos are re-encoded to JPEG through sharp first. Every fetch/decode
 * failure degrades to a plainer card rather than a broken preview.
 */

export const OG_SIZE = { width: 1200, height: 630 };

/** Larger sources aren't worth decoding for a share card. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Brand navy (globals.css `.navy` --foreground). */
const NAVY = "#0b1d3a";
const WHITE = "#ffffff";

/** VON/SCENT mark artwork (alpha mask, 233×240). */
const MARK_PATH = "brand/von-mark.png";
const MARK_RATIO = 233 / 240;

type Rgb = [number, number, number];

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES)
      return null;
    return bytes;
  } catch {
    return null;
  }
}

const dataUrl = (mime: string, buf: Buffer) =>
  `data:${mime};base64,${buf.toString("base64")}`;

const markCache = new Map<string, Promise<string | null>>();

/** The brand mark painted in `color`, as a PNG data URL (null → wordmark). */
function brandMark(color: string): Promise<string | null> {
  let cached = markCache.get(color);
  if (!cached) {
    cached = (async () => {
      let mask: Buffer | null = null;
      try {
        mask = await readFile(join(process.cwd(), "public", MARK_PATH));
      } catch {
        const bytes = await fetchBytes(`${SITE.url}/${MARK_PATH}`);
        mask = bytes ? Buffer.from(bytes) : null;
      }
      const tinted = mask ? await tintMask(mask, color) : null;
      return tinted ? dataUrl("image/png", tinted) : null;
    })();
    markCache.set(color, cached);
  }
  return cached;
}

function Mark({
  src,
  height,
  color,
}: {
  src: string | null;
  height: number;
  color: string;
}) {
  if (!src) {
    return (
      <div style={{ fontSize: height * 0.4, fontWeight: 600, color }}>
        {SITE.brandName}
      </div>
    );
  }
  const width = Math.round(height * MARK_RATIO);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={width} height={height} />;
}

async function loadGoogleFont(
  family: string,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
    const css = await (
      await fetch(url, {
        // Old UA → Google serves TTF (satori can't parse woff2).
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; rv:11.0)" },
      })
    ).text();
    const match = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/u,
    );
    if (!match) return null;
    const res = await fetch(match[1]);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

async function render(content: ReactElement, text: string) {
  const all = `${text}${SITE.brandName}`;
  const [regular, bold] = await Promise.all([
    loadGoogleFont("Noto Sans:wght@400", all),
    loadGoogleFont("Noto Sans:wght@600", all),
  ]);
  const fonts = [
    ...(regular
      ? [{ name: "sans", data: regular, weight: 400 as const }]
      : []),
    ...(bold ? [{ name: "sans", data: bold, weight: 600 as const }] : []),
  ];
  return new ImageResponse(content, {
    ...OG_SIZE,
    ...(fonts.length ? { fonts } : {}),
  });
}

/** Ink colours readable on `bg` (navy on light photos, white on dark). */
function inkFor([r, g, b]: Rgb) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55
    ? { ink: NAVY, muted: "rgba(11,29,58,0.55)", rule: "rgba(11,29,58,0.14)" }
    : {
        ink: WHITE,
        muted: "rgba(255,255,255,0.6)",
        rule: "rgba(255,255,255,0.18)",
      };
}

const rgb = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`;

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        backgroundColor: bg,
        color: fg,
        fontSize: 26,
        fontWeight: 600,
        padding: "8px 22px",
        borderRadius: 999,
      }}
    >
      {label}
    </div>
  );
}

export interface OgSizeRow {
  ml: number;
  price: number;
  /** Crossed-out base price, only when the size is discounted. */
  basePrice?: number;
  soldOut?: boolean;
}

/** Product photo column width — the bottle is the hero of the card. */
const PRODUCT_PHOTO = { width: 600, height: 630 };

/**
 * Product card: the bottle on its own studio background (the card takes the
 * photo's edge colour, so there is no seam) and the 2/5/10/20 ml price list
 * — the shop's whole point, which the preview text never says.
 */
export async function productOgCard({
  imageUrl,
  sizes,
  badge,
}: {
  imageUrl: string | null;
  sizes: OgSizeRow[];
  badge?: string;
}): Promise<ImageResponse> {
  const bytes = imageUrl ? await fetchBytes(imageUrl) : null;
  const photo = bytes
    ? await toOgPhoto(bytes, PRODUCT_PHOTO.width, PRODUCT_PHOTO.height)
    : null;
  const bg: Rgb = photo?.bg ?? [255, 255, 255];
  const { ink, muted, rule } = inkFor(bg);
  const mark = await brandMark(ink);

  const rows = sizes.slice(0, 5);
  const rowFont = rows.length > 4 ? 34 : 40;
  const text = rows
    .map(
      (r) =>
        `${r.ml} мл${formatPrice(r.price)}${r.basePrice ? formatPrice(r.basePrice) : ""}Дууссан`,
    )
    .join("");

  const content = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: rgb(bg),
        color: ink,
        fontFamily: "sans",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...PRODUCT_PHOTO,
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl("image/jpeg", photo.jpeg)}
            alt=""
            {...PRODUCT_PHOTO}
          />
        ) : (
          <Mark src={mark} height={260} color={ink} />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          padding: "56px 80px 56px 24px",
        }}
      >
        {photo ? (
          <Mark src={mark} height={84} color={ink} />
        ) : (
          <div style={{ height: 84 }} />
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r, i) => (
            <div
              key={r.ml}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                padding: "14px 0",
                borderTop: i === 0 ? "none" : `1px solid ${rule}`,
                fontSize: rowFont,
                color: r.soldOut ? muted : ink,
              }}
            >
              <div style={{ display: "flex" }}>{r.ml} мл</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                {r.soldOut ? (
                  <div style={{ fontSize: rowFont * 0.7 }}>Дууссан</div>
                ) : (
                  <>
                    {r.basePrice ? (
                      <div
                        style={{
                          fontSize: rowFont * 0.6,
                          color: muted,
                          textDecoration: "line-through",
                        }}
                      >
                        {formatPrice(r.basePrice)}
                      </div>
                    ) : null}
                    <div style={{ fontWeight: 600 }}>{formatPrice(r.price)}</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {badge ? (
          <Badge label={badge} fg={rgb(bg)} bg={ink} />
        ) : (
          <div style={{ height: 50 }} />
        )}
      </div>
    </div>
  );

  return render(content, `${text}${badge ?? ""}`);
}

/** Bottom band of the wide cover card. */
const BAND_HEIGHT = 128;
/** Covers at least this wide (w/h) go full-bleed; narrower ones go beside. */
const WIDE_COVER = 1.5;
/** Photo column of the tall cover card — 4:5, the shop's card ratio. */
const TALL_PHOTO = { width: 504, height: 630 };

function PriceLine({
  line,
  badge,
  size,
}: {
  line?: string;
  badge?: string;
  size: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {line ? (
        <div style={{ fontSize: size, fontWeight: 600 }}>{line}</div>
      ) : null}
      {badge ? <Badge label={badge} fg={NAVY} bg={WHITE} /> : null}
    </div>
  );
}

/**
 * Cover card (collections, blog): the admin's cover photo with a solid navy
 * panel carrying the mark and one short line (price, discount). A wide
 * cover runs full-bleed above a band; a tall one (collection covers are
 * 4:5) stands whole beside the panel — cropping it to 1.91:1 cut the
 * bottles in half.
 */
export async function coverOgCard({
  imageUrl,
  line,
  badge,
}: {
  imageUrl: string | null;
  line?: string;
  badge?: string;
}): Promise<ImageResponse> {
  const bytes = imageUrl ? await fetchBytes(imageUrl) : null;
  const aspect = bytes ? await imageAspect(bytes) : null;
  const wide = aspect !== null && aspect >= WIDE_COVER;
  const photoSize = wide
    ? { width: OG_SIZE.width, height: OG_SIZE.height - BAND_HEIGHT }
    : TALL_PHOTO;
  const jpeg =
    bytes && aspect !== null
      ? await toJpegCover(bytes, photoSize.width, photoSize.height)
      : null;
  const mark = await brandMark(WHITE);
  const text = `${line ?? ""}${badge ?? ""}`;

  const shell = {
    width: "100%",
    height: "100%",
    display: "flex",
    backgroundColor: NAVY,
    color: WHITE,
    fontFamily: "sans",
  } as const;

  if (!jpeg) {
    return render(
      <div
        style={{
          ...shell,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
        }}
      >
        <Mark src={mark} height={240} color={WHITE} />
        <PriceLine line={line} badge={badge} size={44} />
      </div>,
      text,
    );
  }

  const photo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl("image/jpeg", jpeg)} alt="" {...photoSize} />
  );

  if (wide) {
    return render(
      <div style={{ ...shell, flexDirection: "column" }}>
        {photo}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: BAND_HEIGHT,
            padding: "0 80px",
          }}
        >
          <Mark src={mark} height={88} color={WHITE} />
          <PriceLine line={line} badge={badge} size={40} />
        </div>
      </div>,
      text,
    );
  }

  return render(
    <div style={shell}>
      {photo}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          flex: 1,
          gap: 56,
          padding: "0 80px",
        }}
      >
        <Mark src={mark} height={150} color={WHITE} />
        <PriceLine line={line} badge={badge} size={56} />
      </div>
    </div>,
    text,
  );
}
