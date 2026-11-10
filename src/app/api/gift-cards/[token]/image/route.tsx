import { ImageResponse } from "next/og";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getGiftCardByToken } from "@/features/gift-cards/server";
import { formatGiftAmount } from "@/features/gift-cards/lib";
import { interFonts } from "@/features/gift-cards/og-font";
import {
  BRAND_MARK_RATIO,
  brandMarkDataUrl,
} from "@/features/gift-cards/og-logo";
import { designBackgroundDataUrl } from "@/features/gift-cards/og-background";

/**
 * GET /api/gift-cards/<token>/image — картын PNG (1200×756), имэйл, OG,
 * «Зураг татах»-д (gift-cards-plan §5.3). `GiftCardFace`-ийн байрлалтай ижил;
 * код ХЭЗЭЭ Ч гарахгүй (зураг хуваалцагдана). Token нь эрх.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!(await isFeatureEnabled("gift_cards"))) {
    return new Response("Not found", { status: 404 });
  }
  const { token } = await params;
  const card = await getGiftCardByToken(token, null);
  if (!card || card.status === "void") {
    return new Response("Not found", { status: 404 });
  }
  const d = card.design;
  const message = card.message.trim() || d.defaultMessage || "";
  const [fonts, mark, bg] = await Promise.all([
    interFonts(),
    brandMarkDataUrl(new URL(req.url).origin, d.textColor),
    d.imageUrl ? designBackgroundDataUrl(d.imageUrl, 1200, 756) : null,
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: d.bgColor,
          color: d.textColor,
          fontFamily: "Inter",
        }}
      >
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori
          <img
            src={bg}
            alt=""
            width={1200}
            height={756}
            style={{ position: "absolute", left: 0, top: 0 }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              left: 790,
              top: 270,
              width: 320,
              height: 320,
              borderRadius: 160,
              border: `2px solid ${d.accentColor ?? d.mutedColor}`,
              display: "flex",
            }}
          />
        )}
        {mark ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori
          <img
            src={mark}
            alt=""
            height={88}
            width={Math.round(88 * BRAND_MARK_RATIO)}
            style={{ position: "absolute", left: 64, top: 48 }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              left: 64,
              top: 60,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 8,
              display: "flex",
            }}
          >
            VONSCENT
          </div>
        )}
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1 }}>
            {formatGiftAmount(card.amount)}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 24,
              fontWeight: 700,
              color: d.mutedColor,
            }}
          >
            {`= ${card.amount.toLocaleString("en-US")} V point`}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 216,
            width: 640,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05 }}>
            {d.heading}
          </div>
          <div style={{ marginTop: 32, fontSize: 32, fontWeight: 700 }}>
            {`${card.recipientName} танд,`}
          </div>
          {message ? (
            <div
              style={{
                marginTop: 12,
                maxWidth: 540, // gift-card-face.tsx-тэй ижил
                fontSize: 24,
                lineHeight: 1.45,
                color: d.mutedColor,
              }}
            >
              {message}
            </div>
          ) : null}
          {card.fromName ? (
            <div
              style={{
                marginTop: 24,
                fontSize: 24,
                color: d.mutedColor,
                display: "flex",
              }}
            >
              <span>Илгээгч:&nbsp;</span>
              <span style={{ fontWeight: 700, color: d.textColor }}>
                {card.fromName}
              </span>
            </div>
          ) : null}
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 48,
            fontSize: 22,
            color: d.mutedColor,
            display: "flex",
          }}
        >
          vonscent.mn
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 756,
      fonts,
      // Карт өөрчлөгддөггүй (зөвхөн төлөв) — CDN дээр удаан хадгална.
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
