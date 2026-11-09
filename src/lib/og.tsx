import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";
import {
  tintMask,
  toBlurBackdrop,
  toOgFrame,
} from "@/lib/storage/process-image";

/**
 * Share cards for the per-page dynamic `opengraph-image.tsx` routes. The
 * site-wide card is a static file — see `SITE.ogImage`.
 *
 * One layout for every card (client mockups, 2026-11): the photo framed on
 * the left; on the right the mark, a gold kicker, the serif name, the price
 * and the size pills. Products sit on warm near-black; collections/blog on
 * their own cover, blurred and dimmed. The brand appears once (the mark);
 * no domain — Messenger/Telegram print it under the image already.
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
  const [regular, semibold, bold, serif, serifItalic] = await Promise.all([
    loadGoogleFont("Inter:wght@400", all),
    loadGoogleFont("Inter:wght@600", all),
    loadGoogleFont("Inter:wght@700", all),
    loadGoogleFont(`${SERIF}:wght@500`, all),
    loadGoogleFont(`${SERIF}:ital,wght@1,500`, all),
  ]);
  const font = (
    name: string,
    data: ArrayBuffer | null,
    weight: 400 | 500 | 600 | 700,
    style: "normal" | "italic" = "normal",
  ) => (data ? [{ name, data, weight, style }] : []);
  const fonts = [
    ...font("sans", regular, 400),
    ...font("sans", semibold, 600),
    ...font("sans", bold, 700),
    ...font("serif", serif, 500),
    ...font("serif", serifItalic, 500, "italic"),
  ];
  return new ImageResponse(content, {
    ...OG_SIZE,
    ...(fonts.length ? { fonts } : {}),
  });
}

/** Palette of the mockups — warm near-black, champagne accents. */
const C = {
  bg: "#0c0b0a",
  ink: "#f5f1ea",
  muted: "rgba(245,241,234,0.55)",
  faint: "rgba(245,241,234,0.32)",
  rule: "rgba(245,241,234,0.14)",
  pillBorder: "rgba(245,241,234,0.24)",
  gold: "#c9ad84",
  italic: "#cdbfa9",
  champagne: "#d8c3a0",
  champagneInk: "#1a1612",
  chip: "rgba(12,11,10,0.88)",
  soldOut: "#e8a48f",
  soldOutFill: "rgba(232,164,143,0.08)",
};

/** Framed photo — the left column of every card. */
const FRAME = { width: 432, height: 550 };
const PAD = 40;
/** Right column: from the frame's edge + gap to the right padding. */
const COLUMN_GAP = 64;
const RIGHT_PAD = 72;

/** Trailing name words set in italic (the «edp» of «Sauvage edp»). */
const ITALIC_SUFFIX = new Set(["edp", "edt", "edc", "parfum", "extrait"]);

function splitName(name: string): [string, string | null] {
  const words = name.trim().split(/\s+/);
  const last = words.at(-1) ?? "";
  if (words.length > 1 && ITALIC_SUFFIX.has(last.toLowerCase())) {
    return [words.slice(0, -1).join(" "), last];
  }
  return [name, null];
}

const nameSize = (name: string) =>
  name.length <= 14 ? 84 : name.length <= 20 ? 70 : name.length <= 28 ? 58 : 48;

export interface OgSize {
  ml: number;
  /** Struck through: this size can't be bought right now. */
  off?: boolean;
}

export interface OgCardProps {
  /** Gold caps line over the name — brand, «Багц», blog category. */
  kicker: string;
  name: string;
  /** Top-right caps label — the concentration («EAU DE PARFUM»). */
  label?: string;
  /** Top-right champagne pill — «Хямдрал», «−5% хямдрал». */
  promo?: string;
  /** Chip on the photo — «4 үнэртэн», «Тун удахгүй», «Дууссан». */
  chip?: { text: string; dot?: string };
  /** One muted line under the name — collection members. */
  subline?: string;
  /** «17,000₮» — followed by a muted «-с эхэлнэ». */
  price?: string;
  /** Plain line instead of a price (blog date). */
  note?: string;
  /** Sold out: status pill + note replace the price, the photo fades. */
  soldOut?: boolean;
  sizes?: OgSize[];
  /** Label over the pills; «Хэмжээ сонгох» by default. */
  sizesLabel?: string;
  imageUrl: string | null;
  /** Blurred cover behind the card instead of flat near-black. */
  backdrop?: boolean;
}

function Pill({ size }: { size: OgSize }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 52,
        padding: "0 24px",
        borderRadius: 999,
        border: `1.5px solid ${size.off ? C.rule : C.pillBorder}`,
        fontSize: 19,
        fontWeight: 600,
        color: size.off ? C.faint : C.ink,
        textDecoration: size.off ? "line-through" : "none",
      }}
    >
      {size.ml} мл
    </div>
  );
}

function Caps({
  children,
  color,
  size,
  spacing,
  weight = 600,
}: {
  children: string;
  color: string;
  size: number;
  spacing: number;
  weight?: 400 | 600 | 700;
}) {
  return (
    <div
      style={{
        fontSize: size,
        letterSpacing: spacing,
        textTransform: "uppercase",
        fontWeight: weight,
        color,
      }}
    >
      {children}
    </div>
  );
}

function textOf(p: OgCardProps) {
  const sizes = (p.sizes ?? []).map((s) => `${s.ml} мл`).join("");
  return [
    p.kicker,
    p.kicker.toUpperCase(),
    p.name,
    p.label?.toUpperCase(),
    p.promo,
    p.chip?.text,
    p.subline,
    p.price,
    p.note,
    p.sizesLabel?.toUpperCase(),
    sizes,
    "-с эхэлнэДууссанУдахгүй дахин нэмэгдэнэХЭМЖЭЭ СОНГОХ",
  ]
    .filter(Boolean)
    .join("");
}

async function ogCard(p: OgCardProps): Promise<ImageResponse> {
  const bytes = p.imageUrl ? await fetchBytes(p.imageUrl) : null;
  const [photo, backdrop, mark] = await Promise.all([
    bytes
      ? toOgFrame(bytes, FRAME.width, FRAME.height, { faded: p.soldOut })
      : null,
    bytes && p.backdrop
      ? toBlurBackdrop(bytes, OG_SIZE.width, OG_SIZE.height)
      : null,
    brandMark(C.ink),
  ]);
  const [name, italic] = splitName(p.name);
  const sizesLabel = p.sizesLabel ?? (p.soldOut ? "Хэмжээ" : "Хэмжээ сонгох");

  return render(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        backgroundColor: C.bg,
        color: C.ink,
        fontFamily: "sans",
        padding: PAD,
        gap: COLUMN_GAP,
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
      {backdrop ? (
        // Flat warm-black veil (no gradient): every cover lands in the same
        // dark range, whatever its own colours.
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            ...OG_SIZE,
            backgroundColor: "rgba(12,11,10,0.5)",
          }}
        />
      ) : null}

      {/* Photo frame */}
      <div
        style={{
          display: "flex",
          position: "relative",
          ...FRAME,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "rgba(245,241,234,0.06)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl("image/jpeg", photo)} alt="" {...FRAME} />
        ) : (
          <Mark src={mark} height={200} color={C.ink} />
        )}
        {p.chip ? (
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: C.chip,
              color: C.ink,
              fontSize: 19,
              fontWeight: 600,
              padding: "11px 20px",
              borderRadius: 999,
            }}
          >
            {p.chip.dot ? (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: p.chip.dot,
                }}
              />
            ) : null}
            {p.chip.text}
          </div>
        ) : null}
      </div>

      {/* Text column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: FRAME.height,
          flex: 1,
          paddingRight: RIGHT_PAD - PAD,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Mark src={mark} height={60} color={C.ink} />
          {p.promo ? (
            <div
              style={{
                display: "flex",
                backgroundColor: C.champagne,
                color: C.champagneInk,
                fontSize: 20,
                fontWeight: 600,
                padding: "10px 22px",
                borderRadius: 999,
              }}
            >
              {p.promo}
            </div>
          ) : p.label ? (
            <Caps color={C.muted} size={16} spacing={3} weight={400}>
              {p.label}
            </Caps>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {p.kicker ? (
            <Caps color={C.gold} size={19} spacing={5}>
              {p.kicker}
            </Caps>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              fontFamily: "serif",
              fontWeight: 500,
              fontSize: nameSize(p.name),
              lineHeight: 1.05,
              marginTop: 8,
            }}
          >
            {/* Words as flex items so the name can wrap onto 2 lines. */}
            {name.split(" ").map((w, i) => (
              <span key={i} style={{ marginRight: "0.25em" }}>
                {w}
              </span>
            ))}
            {italic ? (
              <span style={{ fontStyle: "italic", color: C.italic }}>
                {italic}
              </span>
            ) : null}
          </div>
          {p.subline ? (
            <div
              style={{
                fontSize: 19,
                color: "rgba(245,241,234,0.82)",
                marginTop: 18,
                whiteSpace: "nowrap",
              }}
            >
              {p.subline}
            </div>
          ) : null}
          {p.soldOut ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 26,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 58,
                  padding: "0 26px",
                  borderRadius: 999,
                  border: `1.5px solid ${C.soldOut}`,
                  backgroundColor: C.soldOutFill,
                  color: C.soldOut,
                  fontSize: 26,
                  fontWeight: 600,
                }}
              >
                Дууссан
              </div>
              <div style={{ fontSize: 20, color: C.muted }}>
                Удахгүй дахин нэмэгдэнэ
              </div>
            </div>
          ) : p.price ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 14,
                marginTop: 22,
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 700 }}>{p.price}</div>
              <div
                style={{
                  fontSize: 24,
                  color: C.muted,
                  fontWeight: 600,
                  paddingBottom: 9,
                }}
              >
                -с эхэлнэ
              </div>
            </div>
          ) : p.note ? (
            <div style={{ fontSize: 24, color: C.muted, marginTop: 22 }}>
              {p.note}
            </div>
          ) : null}
        </div>

        {p.sizes?.length ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                height: 1,
                backgroundColor: C.rule,
                marginBottom: 26,
              }}
            />
            <Caps color={C.muted} size={14} spacing={4} weight={400}>
              {sizesLabel}
            </Caps>
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              {p.sizes.map((s) => (
                <Pill key={s.ml} size={s} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: 20 }} />
        )}
      </div>
    </div>,
    textOf(p),
  );
}

export type OgCardData = Omit<OgCardProps, "backdrop">;

/** Product card: the studio shot framed on warm near-black. */
export const productOgCard = (p: OgCardData) => ogCard(p);

/** Collection / blog card: the cover framed on its own blurred self. */
export const coverOgCard = (p: OgCardData) => ogCard({ ...p, backdrop: true });

/** Not-found fallback: just the mark and the tagline. */
export const fallbackOgCard = () =>
  ogCard({ kicker: "", name: SITE.tagline, imageUrl: null });

export const OG_CHIP_DOT = { soldOut: C.soldOut, soon: C.champagne };
