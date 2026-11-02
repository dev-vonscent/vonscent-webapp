import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";
import {
  tintMask,
  toBlurBackdrop,
  toJpegCover,
} from "@/lib/storage/process-image";

/**
 * Share cards for the per-page dynamic `opengraph-image.tsx` routes. The
 * site-wide card is a static file — see `SITE.ogImage`.
 *
 * One layout for every card: the photo framed on the left, the mark and a
 * kicker · serif name · price block on the right, on black — the same mood
 * as the site-wide card. Collections/blog swap the black for their own
 * cover, blurred and dimmed. The brand appears once (the mark); no domain —
 * Messenger/Telegram print it under the image already. Names are set in a
 * serif (design.md §3: serif headings, sans body).
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

const SERIF = "Cormorant Garamond";

async function render(content: ReactElement, text: string) {
  const all = `${text}${SITE.brandName}`;
  const [regular, bold, serif] = await Promise.all([
    loadGoogleFont("Inter:wght@400", all),
    loadGoogleFont("Inter:wght@600", all),
    loadGoogleFont(`${SERIF}:wght@600`, all),
  ]);
  const fonts = [
    ...(regular ? [{ name: "sans", data: regular, weight: 400 as const }] : []),
    ...(bold ? [{ name: "sans", data: bold, weight: 600 as const }] : []),
    ...(serif ? [{ name: "serif", data: serif, weight: 600 as const }] : []),
  ];
  return new ImageResponse(content, {
    ...OG_SIZE,
    ...(fonts.length ? { fonts } : {}),
  });
}

const BLACK = "#000000";
const MUTED = "rgba(255,255,255,0.68)";
const RULE = "rgba(255,255,255,0.38)";

/** Framed photo — 4:5, the shop's card ratio. */
const FRAME = { width: 440, height: 550 };

const nameSize = (name: string) =>
  name.length > 28 ? 56 : name.length > 18 ? 68 : 80;

export interface OgCardProps {
  /** Small caps line over the name — brand, «Багц», blog category. */
  kicker: string;
  name: string;
  /** «17,000₮-с», «Дууссан», a date … */
  price?: string;
  /** Line under the price, e.g. «2 · 5 · 10 · 20 мл». */
  sizes?: string;
  badge?: string;
  imageUrl: string | null;
  /** Blurred cover behind the card instead of flat black. */
  backdrop?: boolean;
}

async function ogCard(p: OgCardProps): Promise<ImageResponse> {
  const bytes = p.imageUrl ? await fetchBytes(p.imageUrl) : null;
  const [photo, backdrop, mark] = await Promise.all([
    bytes ? toJpegCover(bytes, FRAME.width, FRAME.height) : null,
    bytes && p.backdrop
      ? toBlurBackdrop(bytes, OG_SIZE.width, OG_SIZE.height)
      : null,
    brandMark(WHITE),
  ]);
  const text = `${p.kicker}${p.kicker.toUpperCase()}${p.name}${p.price ?? ""}${p.sizes ?? ""}${p.badge ?? ""}`;

  return render(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        backgroundColor: BLACK,
        color: WHITE,
        fontFamily: "sans",
        padding: 40,
        gap: 72,
        position: "relative",
      }}
    >
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl("image/jpeg", backdrop)}
          alt=""
          {...OG_SIZE}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      ) : null}
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl("image/jpeg", photo)}
          alt=""
          {...FRAME}
          style={{
            borderRadius: 18,
            ...(backdrop ? { boxShadow: "0 24px 60px rgba(0,0,0,0.45)" } : {}),
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            ...FRAME,
            alignItems: "center",
          }}
        >
          <Mark src={mark} height={220} color={WHITE} />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: FRAME.height,
          flex: 1,
          paddingRight: 40,
        }}
      >
        <Mark src={mark} height={72} color={WHITE} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {p.kicker ? (
            <div
              style={{
                fontSize: 22,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              {p.kicker}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "serif",
              fontWeight: 600,
              fontSize: nameSize(p.name),
              lineHeight: 1.02,
              marginTop: 14,
            }}
          >
            {p.name}
          </div>
          {p.price || p.badge ? (
            // satori flattens fragments into the parent row — wrap in a column.
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  width: 64,
                  height: 1,
                  backgroundColor: RULE,
                  margin: "32px 0",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {p.price ? (
                  <div style={{ fontSize: 34, fontWeight: 600 }}>{p.price}</div>
                ) : null}
                {p.badge ? (
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: WHITE,
                      color: BLACK,
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: 1,
                      padding: "8px 20px",
                      borderRadius: 999,
                    }}
                  >
                    {p.badge}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {p.sizes ? (
            <div style={{ fontSize: 24, color: MUTED, marginTop: 10 }}>
              {p.sizes}
            </div>
          ) : null}
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>,
    text,
  );
}

/** Product card: the studio shot framed on black. */
export const productOgCard = (p: Omit<OgCardProps, "backdrop">) => ogCard(p);

/** Collection / blog card: the cover framed on its own blurred self. */
export const coverOgCard = (p: Omit<OgCardProps, "backdrop">) =>
  ogCard({ ...p, backdrop: true });

/** Not-found fallback: just the mark and the tagline. */
export const fallbackOgCard = () =>
  ogCard({ kicker: "", name: SITE.tagline, imageUrl: null });
