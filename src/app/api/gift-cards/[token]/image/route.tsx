import { ImageResponse } from "next/og";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getGiftCardByToken } from "@/features/gift-cards/server";
import { formatGiftAmount } from "@/features/gift-cards/lib";
import { interFonts } from "@/features/gift-cards/og-font";

/**
 * GET /api/gift-cards/<token>/image — картын PNG (1200×756), имэйл, OG,
 * «Зураг татах»-д (gift-cards-plan §5.3). `GiftCardFace`-ийн байрлалтай ижил;
 * код ХЭЗЭЭ Ч гарахгүй (зураг хуваалцагдана). Token нь эрх.
 */
export async function GET(
  _req: Request,
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
  const fonts = await interFonts();

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
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori
          <img
            src={d.imageUrl}
            alt=""
            width={1200}
            height={756}
            style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }}
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
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 52,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 7,
            display: "flex",
          }}
        >
          VONSCENT
        </div>
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 40,
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
              marginTop: 10,
              fontSize: 16,
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
            top: 200,
            width: 640,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.02 }}>
            {d.heading}
          </div>
          <div style={{ marginTop: 28, fontSize: 26, fontWeight: 700 }}>
            {`${card.recipientName} танд,`}
          </div>
          {message ? (
            <div
              style={{
                marginTop: 10,
                maxWidth: 560,
                fontSize: 20,
                lineHeight: 1.5,
                color: d.mutedColor,
              }}
            >
              {message}
            </div>
          ) : null}
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 52,
            fontSize: 15,
            color: d.mutedColor,
            display: "flex",
          }}
        >
          vonscent.mn
        </div>
        <div
          style={{
            position: "absolute",
            right: 64,
            bottom: 52,
            fontSize: 18,
            color: d.mutedColor,
            display: "flex",
          }}
        >
          <span>Илгээгч:&nbsp;</span>
          <span style={{ fontWeight: 700, color: d.textColor }}>
            {card.fromName}
          </span>
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
