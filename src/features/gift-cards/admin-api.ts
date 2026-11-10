import "server-only";

import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl } from "@/lib/storage/storage";
import type {
  GiftCardDesignRow,
  GiftCardRow,
  GiftCardStatus,
} from "@/db/types";

/**
 * Админ → Бэлгийн карт (gift-cards-plan §5.1). Туг `gift_cards` хаалттай бол
 * хуудас, API хоёулаа 404 (feature-flag-admin-pages). `gift_cards`-д RLS эрх
 * байхгүй тул бүх уншилт service role-оор, ажилтны эрхийг энд шалгана.
 */

export async function giftCardsAdminGate(opts: { superAdmin?: boolean } = {}) {
  if (!(await isFeatureEnabled("gift_cards"))) {
    return {
      error: NextResponse.json({ error: "Олдсонгүй." }, { status: 404 }),
    } as const;
  }
  const staff = await getStaffUser();
  if (!staff || (opts.superAdmin && staff.role !== "super_admin")) {
    return {
      error: NextResponse.json({ error: "Эрх хүрэхгүй." }, { status: 403 }),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ error: "Сан тохируулаагүй." }, { status: 503 }),
    } as const;
  }
  return { staff, supabase } as const;
}

export interface AdminGiftCardListItem {
  id: string;
  code: string;
  amount: number;
  status: GiftCardStatus;
  designTitle: string;
  recipientName: string;
  recipientEmail: string | null;
  fromName: string;
  buyerName: string | null;
  buyerPhone: string | null;
  orderNo: string;
  sendAt: string | null;
  sentAt: string | null;
  lastSendError: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

export const ADMIN_GIFT_STATUSES = [
  "active",
  "redeemed",
  "expired",
  "pending",
  "void",
] as const satisfies readonly GiftCardStatus[];

type Joined = GiftCardRow & {
  orders: { order_no: string } | null;
  buyer: { full_name: string | null; phone: string | null } | null;
  gift_card_designs: { title: string } | null;
};

const LIST_SELECT =
  "*, orders(order_no), buyer:profiles!gift_cards_buyer_id_fkey(full_name, phone), gift_card_designs(title)";

function toListItem(r: Joined): AdminGiftCardListItem {
  return {
    id: r.id,
    code: r.code,
    amount: r.amount,
    status: r.status,
    designTitle: r.gift_card_designs?.title ?? r.design_id,
    recipientName: r.recipient_name,
    recipientEmail: r.recipient_email,
    fromName: r.from_name,
    buyerName: r.buyer?.full_name ?? null,
    buyerPhone: r.buyer?.phone ?? null,
    orderNo: r.orders?.order_no ?? "",
    sendAt: r.send_at,
    sentAt: r.sent_at,
    lastSendError: r.last_send_error,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    createdAt: r.created_at,
  };
}

/** Жагсаалт — төлөвөөр, код / нэр / имэйл / захиалгын дугаараар хайна. */
export async function getAdminGiftCards(filter: {
  status?: GiftCardStatus | null;
  q?: string | null;
}): Promise<AdminGiftCardListItem[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  let query = supabase
    .from("gift_cards")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status) query = query.eq("status", filter.status);
  const q = filter.q?.trim().replace(/[%,()]/gu, " ").trim();
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `code.ilike.${like},recipient_name.ilike.${like},recipient_email.ilike.${like},from_name.ilike.${like}`,
    );
  }
  const { data } = await query;
  return ((data as Joined[] | null) ?? []).map(toListItem);
}

/** Тойм — ашиглагдаагүй үлдэгдэл (өр төлбөр), төлөв бүрийн тоо. */
export async function getAdminGiftCardStats(): Promise<{
  counts: Record<GiftCardStatus, number>;
  outstanding: number;
}> {
  const supabase = createAdminClient();
  const counts = { pending: 0, active: 0, redeemed: 0, expired: 0, void: 0 };
  if (!supabase) return { counts, outstanding: 0 };
  const { data } = await supabase.from("gift_cards").select("status, amount");
  let outstanding = 0;
  for (const r of (data as { status: GiftCardStatus; amount: number }[] | null) ?? []) {
    counts[r.status] += 1;
    if (r.status === "active") outstanding += r.amount;
  }
  return { counts, outstanding };
}

export interface AdminGiftCardDetail extends AdminGiftCardListItem {
  token: string;
  orderId: string;
  message: string | null;
  redeemedByName: string | null;
  redeemedByPhone: string | null;
  points: number | null;
  sendCount: number;
  events: {
    id: number;
    kind: string;
    data: Record<string, unknown>;
    actorName: string | null;
    createdAt: string;
  }[];
}

export async function getAdminGiftCard(
  id: string,
): Promise<AdminGiftCardDetail | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("gift_cards")
    .select(
      `${LIST_SELECT}, redeemer:profiles!gift_cards_redeemed_by_fkey(full_name, phone)`,
    )
    .eq("id", id)
    .maybeSingle();
  const row = data as
    | (Joined & {
        redeemer: { full_name: string | null; phone: string | null } | null;
      })
    | null;
  if (!row) return null;
  const { data: ev } = await supabase
    .from("gift_card_events")
    .select("id, kind, data, created_at, actor:profiles(full_name)")
    .eq("gift_card_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  const events = (
    (ev as
      | {
          id: number;
          kind: string;
          data: Record<string, unknown>;
          created_at: string;
          actor: { full_name: string | null } | null;
        }[]
      | null) ?? []
  ).map((e) => ({
    id: e.id,
    kind: e.kind,
    data: e.data,
    actorName: e.actor?.full_name ?? null,
    createdAt: e.created_at,
  }));
  return {
    ...toListItem(row),
    token: row.token,
    orderId: row.order_id,
    message: row.message,
    redeemedByName: row.redeemer?.full_name ?? null,
    redeemedByPhone: row.redeemer?.phone ?? null,
    points: row.points,
    sendCount: row.send_count,
    events,
  };
}

export interface AdminGiftCardDesign {
  id: string;
  title: string;
  heading: string;
  defaultMessage: string | null;
  imageUrl: string | null;
  bgColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Бүх загвар (идэвхгүйг ч) — админы «Загвар» хэсэг. */
export async function getAdminGiftCardDesigns(): Promise<AdminGiftCardDesign[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("gift_card_designs")
    .select("*")
    .order("sort_order");
  return ((data as GiftCardDesignRow[] | null) ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    heading: r.heading,
    defaultMessage: r.default_message,
    imageUrl: r.image_path ? publicUrl(r.image_path) : null,
    bgColor: r.bg_color,
    textColor: r.text_color,
    mutedColor: r.muted_color,
    accentColor: r.accent_color,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }));
}
