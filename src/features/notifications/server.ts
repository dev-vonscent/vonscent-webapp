import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NOTIFICATION_POLL_FRESH_MAX,
  NOTIFICATION_POLL_LOOKBACK_MS,
} from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTransientAuthError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/storage/storage";
import {
  decodeCursor,
  encodeCursor,
  laterOf,
  ZERO_UUID,
  type NotificationCursor,
} from "./cursor";
import type {
  AppNotification,
  NotificationFeedPage,
  NotificationKind,
  NotificationPoll,
} from "./types";

const notFound = () =>
  NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

/**
 * Хэрэглэгчийн route-ын хаалга: туг (404) → нэвтэрсэн (401) → service-role.
 * Query бүр `user_id`-аар (session-оос) хязгаарлагдана — body/query-гээс
 * хэрэглэгчийн id хэзээ ч авахгүй.
 */
export async function notificationsUserGate() {
  if (!(await isFeatureEnabled("notifications"))) {
    return { response: notFound() } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const supabase = await createClient();
  const { data, error } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };
  // Auth түр унасан — 401 бол клиент poll-ыг бүрмөсөн зогсооно; 503 нь retry.
  if (isTransientAuthError(error)) {
    return {
      response: NextResponse.json(
        { error: "AUTH_UNAVAILABLE" },
        { status: 503 },
      ),
    } as const;
  }
  const user = data.user;
  if (!user) {
    return {
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    } as const;
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { admin, user } as const;
}

export const badCursor = () =>
  NextResponse.json({ error: "BAD_CURSOR" }, { status: 400 });

export function parseCursor(
  raw: string | null | undefined,
): NotificationCursor | null | "invalid" {
  if (!raw) return null;
  return decodeCursor(raw) ?? "invalid";
}

interface Row {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  url: string | null;
  image_path: string | null;
  read_at: string | null;
  visible_at: string;
}

const COLUMNS = "id, kind, title, body, url, image_path, read_at, visible_at";

function toNotification(r: Row): AppNotification {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    imageUrl: r.image_path ? publicUrl(r.image_path) : null,
    read: r.read_at !== null,
    visibleAt: r.visible_at,
  };
}

const cursorOf = (r: Row): string =>
  encodeCursor({ visibleAt: r.visible_at, id: r.id });

/**
 * «Өдрийн үнэгүй эрх сэргэлээ» (0140) нь хүрд нээлттэй үед л үнэн. Устгах
 * биш, УНШИХ үед шүүнэ (plan §4.2): `lucky_wheel` туг эсвэл хүрдний
 * «Идэвхтэй» тохиргоо хаалттай бол харагдахгүй, cleanup хэрэггүй.
 */
async function hideFreeSpin(admin: SupabaseClient): Promise<boolean> {
  if (!(await isFeatureEnabled("lucky_wheel"))) return true;
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "spin")
    .maybeSingle();
  const value = (data as { value?: { enabled?: boolean } } | null)?.value;
  return value?.enabled === false;
}

/**
 * Хэрэглэгчийн ОДОО харагдах мөрүүд (`visible_at <= server now`).
 * `count` нь poll-ын тоонд л.
 */
function visibleRows(
  admin: SupabaseClient,
  userId: string,
  now: string,
  hideSpin: boolean,
  opts: { count?: boolean; head?: boolean } = {},
) {
  let q = admin
    .from("user_notifications")
    .select(opts.head ? "id" : COLUMNS, {
      count: opts.count ? "exact" : undefined,
      head: opts.head,
    })
    .eq("user_id", userId)
    .lte("visible_at", now);
  if (hideSpin) q = q.neq("kind", "free_spin_ready");
  return q;
}

// PostgREST-ийн or()-д утгыг давхар хашилтанд — timestamptz-ийн `:`/`+`.
const before = (c: NotificationCursor) =>
  `visible_at.lt."${c.visibleAt}",and(visible_at.eq."${c.visibleAt}",id.lt.${c.id})`;

/** Feed — `visible_at desc, id desc`, cursor-аас өмнөх `limit` мөр. */
export async function getNotificationFeed(
  admin: SupabaseClient,
  userId: string,
  cursor: NotificationCursor | null,
  limit: number,
): Promise<NotificationFeedPage> {
  const now = new Date().toISOString();
  const hideSpin = await hideFreeSpin(admin);
  let q = visibleRows(admin, userId, now, hideSpin)
    .order("visible_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (cursor) q = q.or(before(cursor));
  const { data, error } = await q;
  if (error) throw new Error(`notification feed: ${error.message}`);
  const rows = (data as unknown as Row[] | null) ?? [];
  const page = rows.slice(0, limit);
  return {
    items: page.map(toNotification),
    nextCursor:
      rows.length > limit && page.length
        ? cursorOf(page[page.length - 1])
        : null,
  };
}

/**
 * Poll — уншаагүйн тоо + cursor-оос `NOTIFICATION_POLL_LOOKBACK_MS` ухарсан
 * цонхонд харагдах уншаагүй мөрүүд. Цонх давхцдаг тул ижил мөр хэд хэдэн
 * poll-д давтагдана — toast hook үзүүлсэн id-аа (`shown`) алгасна.
 *
 * Яагаад ухрах вэ: `visible_at` нь transaction эхэлсэн цаг (`now()`) — урт
 * transaction (оноо нээх cron, том fan-out) cursor-оос ХОЙШ commit хийж болох
 * ба тэр мөрийн `visible_at` cursor-оос бага байна. Мөн хоосон feed-ийн cursor
 * нь app серверийн цаг тул сангийн цагтай зөрж болно.
 *
 * Анхны (cursor-гүй) poll ч цонхны мөрүүдийг буцаана: toast болохгүй
 * (`initial`) ч клиент тэдгээрийг «үзүүлсэн» гэж тэмдэглэж, дараагийн
 * poll-д хуучин уншаагүй toast болохоос сэргийлнэ. Маргааш харагдах мөр
 * (үнэгүй эрх) харагдах үедээ цонхонд орж «шинэ» болно.
 */
export async function pollNotifications(
  admin: SupabaseClient,
  userId: string,
  cursor: NotificationCursor | null,
): Promise<NotificationPoll> {
  const now = new Date().toISOString();
  const hideSpin = await hideFreeSpin(admin);
  const anchor = cursor ? Date.parse(cursor.visibleAt) : Date.parse(now);
  const windowStart = new Date(
    anchor - NOTIFICATION_POLL_LOOKBACK_MS,
  ).toISOString();

  const unreadQ = visibleRows(admin, userId, now, hideSpin, {
    count: true,
    head: true,
  }).is("read_at", null);

  const freshQ = visibleRows(admin, userId, now, hideSpin, { count: true })
    .is("read_at", null)
    .gt("visible_at", windowStart)
    .order("visible_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTIFICATION_POLL_FRESH_MAX);

  const [unreadRes, freshRes] = await Promise.all([unreadQ, freshQ]);
  if (unreadRes.error)
    throw new Error(`notification unread: ${unreadRes.error.message}`);
  if (freshRes.error)
    throw new Error(`notification poll: ${freshRes.error.message}`);

  const rows = (freshRes.data as unknown as Row[] | null) ?? [];
  const newest = rows[0]
    ? { visibleAt: rows[0].visible_at, id: rows[0].id }
    : null;
  const base = cursor ?? { visibleAt: now, id: ZERO_UUID };

  return {
    unread: unreadRes.count ?? 0,
    freshCount: freshRes.count ?? rows.length,
    fresh: rows.map(toNotification),
    // Cursor зөвхөн урагшилна — хоцорсон мөр цонхны ухралтаар л баригдана.
    nextCursor: encodeCursor(newest ? laterOf(base, newest) : base),
  };
}
