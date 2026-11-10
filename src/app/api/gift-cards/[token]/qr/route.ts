import QRCode from "qrcode";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { env } from "@/lib/env";
import { getGiftCardByToken } from "@/features/gift-cards/server";
import { giftUrl } from "@/features/gift-cards/lib";

/**
 * GET /api/gift-cards/<token>/qr — `/gift/<token>` руу заасан QR (PNG).
 * Имэйлийг компьютерээс нээсэн хүн утсаараа уншуулна (gift-cards-plan §6.1).
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
  const png = await QRCode.toBuffer(giftUrl(token, env.siteUrl), {
    type: "png",
    width: 288,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
