import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl } from "@/lib/storage/storage";
import type { GiftCardDesignRow, GiftCardRow } from "@/db/types";
import type {
  GiftCardDesign,
  GiftCardPublicView,
  MyGiftCard,
} from "./types";

/**
 * Бэлгийн картын уншилт (0179). `gift_cards`-д RLS эрх байхгүй — бүгд service
 * role-оор, эрх шалгалт энд (buyer/redeemer) эсвэл token-оор.
 */

const DESIGN_SELECT =
  "id, title, heading, default_message, image_path, bg_color, text_color, muted_color, accent_color, sort_order, is_active";

function toDesign(row: GiftCardDesignRow): GiftCardDesign {
  return {
    id: row.id,
    title: row.title,
    heading: row.heading,
    defaultMessage: row.default_message,
    imageUrl: row.image_path ? publicUrl(row.image_path) : null,
    bgColor: row.bg_color,
    textColor: row.text_color,
    mutedColor: row.muted_color,
    accentColor: row.accent_color,
  };
}

/** Идэвхтэй загварууд, эрэмбээр. */
export async function getGiftCardDesigns(): Promise<GiftCardDesign[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("gift_card_designs")
    .select(DESIGN_SELECT)
    .eq("is_active", true)
    .order("sort_order");
  return ((data as GiftCardDesignRow[] | null) ?? []).map(toDesign);
}

/** Идэвхгүй болсон ч хуучин карт өөрийн загвараараа зурагдана. */
async function designsByIds(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  ids: string[],
): Promise<Map<string, GiftCardDesign>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("gift_card_designs")
    .select(DESIGN_SELECT)
    .in("id", [...new Set(ids)]);
  return new Map(
    ((data as GiftCardDesignRow[] | null) ?? []).map((r) => [r.id, toDesign(r)]),
  );
}

/** Нэг загвар (идэвхгүй ч) — захиалгын мөрийн thumbnail. */
export async function getGiftCardDesign(
  id: string,
): Promise<GiftCardDesign | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  return (await designsByIds(supabase, [id])).get(id) ?? null;
}

const FALLBACK_DESIGN: GiftCardDesign = {
  id: "classic",
  title: "Үндсэн",
  heading: "Танд зориулав",
  defaultMessage: null,
  imageUrl: null,
  bgColor: "#0E1B3B",
  textColor: "#FFFFFF",
  mutedColor: "#B8C0D6",
  accentColor: "#C9A86A",
};

/**
 * `/gift/[token]` — нэвтрэлтгүй. Төлөгдөөгүй (`pending`) картыг байхгүй мэт
 * үзнэ: холбоос нь төлбөрөөс өмнө хаана ч очдоггүй.
 */
export async function getGiftCardByToken(
  token: string,
  viewerId: string | null,
): Promise<GiftCardPublicView | null> {
  if (!/^[0-9a-f]{32}$/u.test(token)) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("gift_cards")
    .select(
      "token, status, amount, design_id, recipient_name, message, from_name, expires_at, redeemed_by, redeemed_at, buyer_id",
    )
    .eq("token", token)
    .maybeSingle();
  const row = data as Pick<
    GiftCardRow,
    | "token"
    | "status"
    | "amount"
    | "design_id"
    | "recipient_name"
    | "message"
    | "from_name"
    | "expires_at"
    | "redeemed_by"
    | "redeemed_at"
    | "buyer_id"
  > | null;
  if (!row || row.status === "pending") return null;
  const designs = await designsByIds(supabase, [row.design_id]);
  // Хугацаа дууссан ч cron хараахан ажиллаагүй бол — хэрэглэгчид үнэнийг.
  const expired =
    row.status === "active" &&
    row.expires_at !== null &&
    new Date(row.expires_at).getTime() <= Date.now();
  return {
    token: row.token,
    status: expired ? "expired" : row.status,
    amount: row.amount,
    recipientName: row.recipient_name,
    message: row.message ?? "",
    fromName: row.from_name,
    expiresAt: row.expires_at,
    design: designs.get(row.design_id) ?? FALLBACK_DESIGN,
    redeemedByViewer: viewerId !== null && row.redeemed_by === viewerId,
    viewerIsBuyer: viewerId !== null && row.buyer_id === viewerId,
    redeemedAt: row.redeemed_at,
  };
}

/** Миний худалдан авсан (төлөгдсөн) ба оноо болгосон картууд. */
export async function getMyGiftCards(userId: string): Promise<MyGiftCard[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("gift_cards")
    .select("*")
    .or(`buyer_id.eq.${userId},redeemed_by.eq.${userId}`)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data as GiftCardRow[] | null) ?? [];
  const designs = await designsByIds(
    supabase,
    rows.map((r) => r.design_id),
  );
  return rows
    .filter((r) => r.status !== "void")
    .map((r) => {
      const role = r.buyer_id === userId ? "bought" : "received";
      // Хугацаа өнгөрсөн ч өдрийн cron хараахан тэмдэглээгүй — хүлээн
      // авагчийн хуудастай (`getGiftCardByToken`) ижил үнэнийг харуулна.
      const status: GiftCardRow["status"] =
        r.status === "active" &&
        r.expires_at !== null &&
        new Date(r.expires_at).getTime() <= Date.now()
          ? "expired"
          : r.status;
      // Код/холбоосыг зөвхөн худалдан авагчид, ашиглагдаагүй үед — оноо
      // болсон кодыг дахин хуваалцах шалтгаан байхгүй.
      const shareable = role === "bought" && status === "active";
      return {
        id: r.id,
        role,
        status,
        amount: r.amount,
        recipientName: r.recipient_name,
        message: r.message ?? "",
        fromName: r.from_name,
        design: designs.get(r.design_id) ?? FALLBACK_DESIGN,
        code: shareable ? r.code : null,
        token: shareable ? r.token : null,
        recipientEmail: role === "bought" ? r.recipient_email : null,
        sendAt: role === "bought" ? r.send_at : null,
        sentAt: r.sent_at,
        issuedAt: r.issued_at,
        expiresAt: r.expires_at,
        redeemedAt: r.redeemed_at,
        points: r.points,
        orderId: r.order_id,
        createdAt: r.created_at,
      } satisfies MyGiftCard;
    });
}

/** Төлбөрийн хуудасны «төлөгдлөө» хэсэгт — захиалгын карт. */
export async function getOrderGiftCard(orderId: string): Promise<{
  recipientName: string;
  recipientEmail: string | null;
  sendAt: string | null;
} | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("gift_cards")
    .select("recipient_name, recipient_email, send_at")
    .eq("order_id", orderId)
    .maybeSingle();
  const row = data as {
    recipient_name: string;
    recipient_email: string | null;
    send_at: string | null;
  } | null;
  return row
    ? {
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        sendAt: row.send_at,
      }
    : null;
}
