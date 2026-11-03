import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { META_GRAPH_API_VERSION } from "@/lib/constants";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientIp } from "@/lib/rate-limit";
import type { PaidSource } from "@/lib/payments/confirm-order";

/**
 * Meta Conversions API — Purchase-ийг серверээс (`meta_capi` туг, 0171).
 *
 * Browser pixel-ийн Purchase нь `/pay/<token>` хуудас «төлөгдсөн» болох
 * мөчид л явдаг тул банкны аппаар төлөөд буцаагүй, ad blocker-тэй, эсвэл
 * дансаар шилжүүлснийг админ гараар баталсан захиалга Meta-д огт хүрдэггүй.
 * Энд `mark_order_paid`-ийн дараа серверээс илгээнэ.
 *
 * Давхардал: browser ба сервер хоёулаа `event_id = order_no` өгдөг тул Meta
 * хоёуланг нь хүлээн авбал нэг л удаа тоолно (`lib/analytics.ts`
 * `trackPurchase`).
 *
 * Best-effort: юу ч болсон төлбөрийн commit-ийг эвдэхгүй — алдааг Sentry-д.
 */

const ENDPOINT = (datasetId: string) =>
  `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${datasetId}/events`;

const TIMEOUT_MS = 5000;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Meta-гийн `ph`: улсын кодтой, зөвхөн цифр. Захиалгын утас нь 8 оронтой
 * дотоодын дугаар (`validators/order.ts`) — урд нь 976 залгана.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 8) return `976${digits}`;
  if (digits.length === 11 && digits.startsWith("976")) return digits;
  return null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const v = (email ?? "").trim().toLowerCase();
  return v.includes("@") ? v : null;
}

/** `Cookie` header-ээс pixel-ийн `_fbp` / `_fbc`. */
export function metaCookies(cookieHeader: string | null): {
  fbp: string | null;
  fbc: string | null;
} {
  const out = { fbp: null as string | null, fbc: null as string | null };
  for (const part of (cookieHeader ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    if (!value) continue;
    if (name === "_fbp") out.fbp = value;
    else if (name === "_fbc") out.fbc = value;
  }
  return out;
}

export interface PurchaseInput {
  orderNo: string;
  value: number;
  contentIds: string[];
  numItems: number;
  /** Unix секунд. */
  eventTime: number;
  eventSourceUrl: string;
  phone: string | null;
  email: string | null;
  userId: string | null;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  userAgent: string | null;
}

/**
 * CAPI-ийн нэг Purchase event. Цэвэр функц — тестэд шууд шалгагдана.
 *
 * Hash хийх: `ph`, `em`, `external_id` (Meta зөвлөсөн). Hash хийхгүй: `fbp`,
 * `fbc`, IP, UA — Meta тэдгээрийг түүхийгээр нь хүлээнэ. Хоосон талбарыг
 * огт явуулахгүй (хоосон мөрийн hash нь буруу тааруулалт өгнө).
 */
export function buildPurchaseEvent(input: PurchaseInput) {
  const ph = normalizePhone(input.phone);
  const em = normalizeEmail(input.email);
  const userData: Record<string, string | string[]> = {};
  if (ph) userData.ph = [sha256(ph)];
  if (em) userData.em = [sha256(em)];
  if (input.userId) userData.external_id = [sha256(input.userId)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.ip) userData.client_ip_address = input.ip;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  return {
    event_name: "Purchase",
    event_time: input.eventTime,
    event_id: input.orderNo,
    action_source: "website",
    event_source_url: input.eventSourceUrl,
    user_data: userData,
    custom_data: {
      value: input.value,
      currency: "MNT",
      content_ids: input.contentIds,
      content_type: "product",
      num_items: input.numItems,
      order_id: input.orderNo,
    },
  };
}

/** CAPI-д тохиргоо бүрэн эсэх (token + dataset id). */
function configured(): boolean {
  return Boolean(env.metaCapiToken && env.metaPixelId);
}

/**
 * Захиалга үүсэх мөчид Meta-гийн cookie, IP, UA-г захиалга дээр бичнэ.
 * Туг хаалттай бол юу ч хадгалахгүй — prod дээр өгөгдөл хуримтлагдахгүй.
 */
export async function captureOrderContext(
  supabase: SupabaseClient,
  orderId: string,
  req: Request,
): Promise<void> {
  try {
    if (!configured() || !(await isFeatureEnabled("meta_capi"))) return;
    const { fbp, fbc } = metaCookies(req.headers.get("cookie"));
    await supabase
      .from("orders")
      .update({
        meta_fbp: fbp,
        meta_fbc: fbc,
        client_ip: clientIp(req),
        client_user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
      })
      .eq("id", orderId);
  } catch (err) {
    Sentry.captureException(err);
  }
}

interface OrderRow {
  order_no: string;
  total: number;
  contact_phone: string | null;
  contact_email: string | null;
  user_id: string | null;
  meta_fbp: string | null;
  meta_fbc: string | null;
  client_ip: string | null;
  client_user_agent: string | null;
}

interface ItemRow {
  product_id: string | null;
  qty: number;
  is_sample: boolean;
  is_gift: boolean;
}

/**
 * Төлбөр баталгаажсаны дараах Purchase. `confirm-order.ts`-ийн `commit()`-оос
 * дуудагдана — `alreadyPaid` зам тийш хүрдэггүй тул нэг захиалгад нэг удаа.
 *
 * `mock` эх үүсвэр (QPay-гүй dev/preview-ийн хуурамч төлбөр) нь бодит
 * худалдан авалт биш — зөвхөн `META_CAPI_TEST_EVENT_CODE` тавигдсан үед
 * Test events руу явна.
 */
export async function reportPurchase(
  supabase: SupabaseClient,
  orderId: string,
  source: PaidSource,
): Promise<void> {
  try {
    if (!configured()) return;
    if (source === "mock" && !env.metaCapiTestEventCode) return;
    if (!(await isFeatureEnabled("meta_capi"))) return;

    const { data } = await supabase
      .from("orders")
      .select(
        "order_no, total, contact_phone, contact_email, user_id, meta_fbp, meta_fbc, client_ip, client_user_agent",
      )
      .eq("id", orderId)
      .maybeSingle();
    const order = data as OrderRow | null;
    if (!order) return;

    const { data: itemData } = await supabase
      .from("order_items")
      .select("product_id, qty, is_sample, is_gift")
      .eq("order_id", orderId);
    // Бэлгийн дээж, бэлэг нь худалдан авсан бараа биш.
    const items = ((itemData as ItemRow[] | null) ?? []).filter(
      (i) => !i.is_sample && !i.is_gift,
    );

    const event = buildPurchaseEvent({
      orderNo: order.order_no,
      value: order.total,
      contentIds: [
        ...new Set(items.map((i) => i.product_id).filter(Boolean)),
      ] as string[],
      numItems: items.reduce((n, i) => n + i.qty, 0),
      eventTime: Math.floor(Date.now() / 1000),
      // `/pay/<token>` биш: token нь төлбөрийн хуудасны түлхүүр, гуравдагч
      // тал руу явах ёсгүй. Домэйн л тааруулалтад хэрэгтэй.
      eventSourceUrl: `${env.siteUrl}/checkout`,
      phone: order.contact_phone,
      email: order.contact_email,
      userId: order.user_id,
      fbp: order.meta_fbp,
      fbc: order.meta_fbc,
      ip: order.client_ip,
      userAgent: order.client_user_agent,
    });

    const res = await fetch(ENDPOINT(env.metaPixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [event],
        ...(env.metaCapiTestEventCode
          ? { test_event_code: env.metaCapiTestEventCode }
          : {}),
        // Query string биш body-д — access log-д token үлдэхгүй.
        access_token: env.metaCapiToken,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      Sentry.captureMessage(`meta capi ${res.status}: ${body.slice(0, 500)}`, {
        level: "warning",
        extra: { orderNo: order.order_no },
      });
    }
  } catch (err) {
    Sentry.captureException(err);
  }
}
