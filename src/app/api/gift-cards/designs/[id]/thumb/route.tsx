import { ImageResponse } from "next/og";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getGiftCardDesign } from "@/features/gift-cards/server";
import {
  BRAND_MARK_RATIO,
  brandMarkDataUrl,
} from "@/features/gift-cards/og-logo";

/** 44–56px дөрвөлжин мөрөнд 4x. */
const SIZE = 224;
const CARD_W = 208;
const CARD_H = Math.round((CARD_W * 756) / 1200);

/**
 * GET /api/gift-cards/designs/<id>/thumb — захиалгын мөрийн зураг
 * (`order_items.image_url`, 0179 `place_gift_card_order`). Тунгалаг
 * дөрвөлжин дотор загварын жижиг карт: лого + чимэглэл. Хувийн өгөгдөл
 * (нэр, мэндчилгээ, код) огт орохгүй — зөвхөн загвар, тиймээс токенгүй.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isFeatureEnabled("gift_cards"))) {
    return new Response("Not found", { status: 404 });
  }
  const { id } = await params;
  if (!/^[a-z0-9-]{2,40}$/u.test(id)) {
    return new Response("Not found", { status: 404 });
  }
  const d = await getGiftCardDesign(id);
  if (!d) return new Response("Not found", { status: 404 });
  const mark = d.imageUrl
    ? null
    : await brandMarkDataUrl(new URL(req.url).origin, d.textColor);
  const markH = 30;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 14,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            backgroundColor: d.bgColor,
          }}
        >
          {d.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori
            <img
              src={d.imageUrl}
              alt=""
              width={CARD_W}
              height={CARD_H}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <>
              {mark ? (
                // eslint-disable-next-line @next/next/no-img-element -- satori
                <img
                  src={mark}
                  alt=""
                  height={markH}
                  width={Math.round(markH * BRAND_MARK_RATIO)}
                  style={{ position: "absolute", left: 14, top: 12 }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  left: CARD_W - 16 - 64,
                  top: 30,
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  border: `2px solid ${d.accentColor ?? d.mutedColor}`,
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 18,
                  width: 72,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: d.mutedColor,
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  bottom: 30,
                  width: 104,
                  height: 9,
                  borderRadius: 4,
                  backgroundColor: d.textColor,
                  display: "flex",
                }}
              />
            </>
          )}
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      // Админ загварын өнгө/зургийг солих боломжтой — богино хугацаагаар.
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
