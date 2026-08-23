import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

/**
 * Shared scaffolding for the dynamic `opengraph-image.tsx` routes.
 *
 * next/og (satori) ships only a latin Inter subset, so Cyrillic titles would
 * render as tofu — we fetch a per-request Google-Fonts subset containing
 * exactly the glyphs used. The subsetted woff is tiny (a few KB) and the
 * rendered image is cached by ISR alongside the page.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const GOLD = "#c9a227";
const BG = "#0d0b08";

async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
    const css = await (
      await fetch(url, {
        // Old UA → Google serves TTF (satori can't parse woff2).
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; rv:11.0)" },
      })
    ).text();
    const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/u);
    if (!match) return null;
    const res = await fetch(match[1]);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

interface OgCardProps {
  /** Small uppercase line above the title (brand, category …). */
  kicker?: string;
  title: string;
  /** Line under the title (price, excerpt …). */
  subtitle?: string;
  /** Right-hand side photo URL; omitted → text-only layout. */
  imageUrl?: string | null;
  /** Extra badge text (e.g. "-20%"). */
  badge?: string;
}

/** Renders the brand OG card. All og image routes funnel through this. */
export async function ogCard({
  kicker,
  title,
  subtitle,
  imageUrl,
  badge,
}: OgCardProps): Promise<ImageResponse> {
  const text = `${SITE.name}${SITE.tagline}${kicker ?? ""}${title}${subtitle ?? ""}${badge ?? ""}${SITE.domain}`;
  const [serif, sans] = await Promise.all([
    loadGoogleFont("Playfair Display:wght@600", text),
    loadGoogleFont("Noto Sans:wght@400", text),
  ]);

  const fonts = [
    ...(serif ? [{ name: "serif", data: serif, weight: 600 as const }] : []),
    ...(sans ? [{ name: "sans", data: sans, weight: 400 as const }] : []),
  ];

  const content: ReactNode = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: BG,
        color: "#f5f0e6",
        fontFamily: "sans, serif",
      }}
    >
      {/* Text column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          flex: 1,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontFamily: "serif",
              fontSize: 40,
              color: GOLD,
              letterSpacing: 2,
            }}
          >
            {SITE.name}
          </div>
          <div style={{ fontSize: 22, color: "#8a8272" }}>{SITE.tagline}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {kicker ? (
            <div
              style={{
                fontSize: 26,
                textTransform: "uppercase",
                letterSpacing: 4,
                color: GOLD,
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "serif",
              fontSize: title.length > 40 ? 52 : 64,
              lineHeight: 1.15,
              fontWeight: 600,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 28, color: "#b8ae9c" }}>{subtitle}</div>
          ) : null}
          {badge ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                backgroundColor: GOLD,
                color: BG,
                fontSize: 28,
                fontWeight: 600,
                padding: "6px 20px",
                borderRadius: 999,
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 24, color: "#8a8272" }}>{SITE.domain}</div>
      </div>

      {/* Photo column */}
      {imageUrl ? (
        <div
          style={{
            display: "flex",
            width: 460,
            height: "100%",
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            width={460}
            height={630}
            style={{ objectFit: "cover", width: 460, height: 630 }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(13,11,8,1) 0%, rgba(13,11,8,0) 30%)",
            }}
          />
        </div>
      ) : null}
    </div>
  );

  return new ImageResponse(content, {
    ...OG_SIZE,
    ...(fonts.length ? { fonts } : {}),
  });
}
