import "server-only";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl, storagePath } from "@/lib/storage/storage";
import {
  BROADCAST_TITLE_MAX,
  type BroadcastInput,
} from "@/lib/validators/notification";
import type {
  BroadcastAdminRow,
  BroadcastLinkTarget,
  BroadcastPrefill,
  BroadcastStatus,
} from "./broadcast-types";

/**
 * Админы broadcast route бүрийн хаалга: туг (404) → staff (403) → service-role.
 * Илгээх эрх `operator` + `super_admin` (клиент баталсан, 2026-10-18) —
 * `getStaffUser()` яг эдгээрийг л зөвшөөрдөг.
 */
export async function broadcastAdminGate() {
  if (!(await isFeatureEnabled("notifications"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const staff = await getStaffUser();
  if (!staff) {
    return {
      response: NextResponse.json(
        { error: "Эрх баталгаажсангүй. Хуудсаа сэргээгээд дахин нэвтэрнэ үү." },
        { status: 403 },
      ),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { supabase, staff } as const;
}

export const badRequest = (error = "VALIDATION") =>
  NextResponse.json({ error }, { status: 400 });

export const conflict = (error: string) =>
  NextResponse.json({ error }, { status: 409 });

export const serverError = (err: unknown, route: string) => {
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
    tags: { route },
  });
  return NextResponse.json(
    { error: "Алдаа гарлаа. Дахин оролдоно уу." },
    { status: 500 },
  );
};

/**
 * Маягтын утга → `notification_broadcasts` мөр. Зураг нь манай bucket-ийн
 * URL байх ёстой (path болгон хадгална) — гадны URL → null + алдаа.
 */
export function toBroadcastColumns(
  input: BroadcastInput,
): { ok: true; columns: Record<string, unknown> } | { ok: false } {
  let imagePath: string | null = null;
  if (input.imageUrl) {
    imagePath = storagePath(input.imageUrl);
    if (!imagePath) return { ok: false };
  }
  return {
    ok: true,
    columns: {
      kind: input.kind,
      title: input.title,
      body: input.body || null,
      url: input.url || null,
      image_path: imagePath,
    },
  };
}

/** Засварлах дүрэм: зөвхөн илгээгдээгүй (`draft` / `scheduled`). */
export const EDITABLE_STATUSES: BroadcastStatus[] = ["draft", "scheduled"];

/** Хуваарь 24 цагаас хэтэрвэл cron илгээхгүй (0138) — админд тэмдэглэнэ. */
const OVERDUE_MS = 24 * 60 * 60 * 1000;

interface BroadcastDbRow {
  id: string;
  kind: BroadcastAdminRow["kind"];
  title: string;
  body: string | null;
  url: string | null;
  image_path: string | null;
  publish_at: string;
  status: BroadcastStatus;
  sent_at: string | null;
  recipient_count: number | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

const LIST_LIMIT = 100;

/**
 * Админы жагсаалт + уншсан тоо. Уншсан тоо нь `user_notifications`-аас
 * (хэрэглэгч бүр зөвхөн өөрийнхөө мөрийг уншдаг RLS) — service-role.
 * Илгээсэн broadcast бүрт `count: exact, head` — мөр татахгүй.
 */
export async function getBroadcastsAdmin(
  supabase: SupabaseClient,
): Promise<{ rows: BroadcastAdminRow[]; audience: number }> {
  const [list, audience] = await Promise.all([
    supabase
      .from("notification_broadcasts")
      .select(
        "id, kind, title, body, url, image_path, publish_at, status, sent_at, recipient_count, cancelled_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  if (list.error) throw new Error(`broadcasts list: ${list.error.message}`);
  const rows = (list.data as BroadcastDbRow[] | null) ?? [];

  const readCounts = await Promise.all(
    rows.map(async (r) => {
      if (r.status !== "sent") return 0;
      const { count } = await supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("broadcast_id", r.id)
        .not("read_at", "is", null);
      return count ?? 0;
    }),
  );

  const now = Date.now();
  return {
    audience: audience.count ?? 0,
    rows: rows.map((r, i) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body ?? "",
      url: r.url ?? "",
      imageUrl: r.image_path ? publicUrl(r.image_path) : null,
      publishAt: r.publish_at,
      status: r.status,
      overdue:
        r.status === "scheduled" && now - Date.parse(r.publish_at) > OVERDUE_MS,
      sentAt: r.sent_at,
      recipientCount: r.recipient_count ?? 0,
      readCount: readCounts[i],
      cancelledAt: r.cancelled_at,
      createdAt: r.created_at,
    })),
  };
}

/** PostgREST-ийн `or()`/`ilike` утгад аюултай тэмдэгтүүдийг хасна. */
function cleanTerm(q: string): string {
  return q
    .replace(/[,()*%\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Холбоосын сонгогч — бараа ба багц нэрээр. Зураг нь эхний харагдах зураг
 * (`product_images.url` нь манай bucket-ийн public URL) — «Шинэ бараа»
 * мэдэгдэлд thumbnail болгож болно.
 */
export async function searchBroadcastLinkTargets(
  supabase: SupabaseClient,
  q: string,
): Promise<BroadcastLinkTarget[]> {
  const term = cleanTerm(q).slice(0, 60);
  const pattern = `%${term}%`;

  let products = supabase
    .from("products")
    .select(
      "slug, name, brand, status, product_images(url, sort_order, is_visible)",
    )
    .neq("status", "hidden")
    .order("created_at", { ascending: false })
    .limit(10);
  if (term)
    products = products.or(`name.ilike.${pattern},brand.ilike.${pattern}`);

  let collections = supabase
    .from("collections")
    .select("slug, name, image_url")
    .eq("type", "base")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);
  if (term) collections = collections.ilike("name", pattern);

  const [p, c] = await Promise.all([products, collections]);
  if (p.error) throw new Error(`link targets products: ${p.error.message}`);
  if (c.error) throw new Error(`link targets collections: ${c.error.message}`);

  type P = {
    slug: string;
    name: string;
    brand: string;
    product_images:
      | { url: string; sort_order: number; is_visible: boolean }[]
      | null;
  };
  type C = { slug: string; name: string; image_url: string | null };

  const ours = (url: string | null | undefined) =>
    url && storagePath(url) ? url : null;

  return [
    ...((p.data as unknown as P[] | null) ?? []).map(
      (r): BroadcastLinkTarget => {
        const img = (r.product_images ?? [])
          .filter((i) => i.is_visible)
          .sort((a, b) => a.sort_order - b.sort_order)[0];
        return {
          type: "product",
          label: `${r.brand} ${r.name}`,
          url: `/products/${r.slug}`,
          imageUrl: ours(img?.url),
        };
      },
    ),
    ...((c.data as unknown as C[] | null) ?? []).map(
      (r): BroadcastLinkTarget => ({
        type: "collection",
        label: r.name,
        url: `/collections/${r.slug}`,
        imageUrl: ours(r.image_url),
      }),
    ),
  ];
}

/** Бараа засах хуудасны «Шинэ бараа мэдэгдэл илгээх» — урьдчилан бөглөсөн маягт. */
export async function getBroadcastProductPrefill(
  supabase: SupabaseClient,
  slug: string,
): Promise<BroadcastPrefill | null> {
  const { data } = await supabase
    .from("products")
    .select("slug, name, brand, product_images(url, sort_order, is_visible)")
    .eq("slug", slug)
    .maybeSingle();
  const p = data as {
    slug: string;
    name: string;
    brand: string;
    product_images:
      | { url: string; sort_order: number; is_visible: boolean }[]
      | null;
  } | null;
  if (!p) return null;
  const img = (p.product_images ?? [])
    .filter((i) => i.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    kind: "product_new",
    title: `Шинэ: ${p.brand} ${p.name}`.slice(0, BROADCAST_TITLE_MAX),
    body: "2ml-ээс эхлэн туршиж үзээрэй.",
    url: `/products/${p.slug}`,
    imageUrl: img?.url && storagePath(img.url) ? img.url : null,
  };
}
