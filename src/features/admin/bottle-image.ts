import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STORAGE_BUCKET,
  deleteImage,
  publicUrl,
  storagePath,
} from "@/lib/storage/storage";
import { isBottleImageUrl } from "./lib/bottle";
import { BOTTLE_STYLE_LABEL, type BottleStyle } from "@/lib/constants";

/**
 * Савны зургийн эх хувь — Storage-д `scripts/upload-bottle-images.ts`
 * оруулна.
 */
export const BOTTLE_MASTER_PATH = (s: BottleStyle) => `bottles/${s}.webp`;

/** Эх хувийг бүтээгдэхүүний хавтас руу хуулна; Storage-ийн замыг буцаана. */
async function copyBottleMaster(
  supabase: SupabaseClient,
  slug: string,
  style: BottleStyle,
): Promise<string | null> {
  const path = `products/${slug}/bottle-${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .copy(BOTTLE_MASTER_PATH(style), path);
  if (error) {
    console.error("[bottle-image] copy failed", error.message);
    return null;
  }
  return path;
}

/** Галерейн хэддэх зураг болох вэ (0-ээс) — 3 дахь. */
const BOTTLE_POSITION = 2;

/**
 * Админы сонгосон савны зургийг бүтээгдэхүүний галерейд нэмнэ:
 *  - `"third"` — 3 дахь байранд (зураг цөөн бол хамгийн ард), араас нь байсан
 *    зургууд нэг байр ухарна. AI-ийн packshot + нотын зургийн дараа.
 *  - `"end"` — хамгийн ард. Админ зургаа гараар оруулсан үед.
 *
 * Эх хувийг бүтээгдэхүүн бүрт **хуулна**, нэг объект руу заахгүй: админ
 * галерейгаас зураг устгахад Storage-ийн объект нь хамт устдаг тул хуваалцсан
 * объект бол нэг устгалт бүх бүтээгдэхүүний зургийг эвдэнэ.
 *
 * Хэзээ ч шидэхгүй — савны зураггүй бүтээгдэхүүн бүтээгдэхүүн хэвээрээ.
 * Зураг нэмэгдсэн эсэхийг буцаана (нийтлэх эсэхийг дуудагч өөрөө
 * `hasVisibleImage`-ээр шийднэ).
 */
export async function addBottleImage(
  supabase: SupabaseClient,
  productId: string,
  slug: string,
  style: BottleStyle,
  placement: "third" | "end",
): Promise<boolean> {
  try {
    const path = await copyBottleMaster(supabase, slug, style);
    if (!path) return false;

    const { data } = await supabase
      .from("product_images")
      .select("id, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    const rows = (data as { id: string; sort_order: number }[] | null) ?? [];
    const row = {
      product_id: productId,
      url: publicUrl(path),
      alt: BOTTLE_STYLE_LABEL[style],
      is_visible: true,
    };

    if (placement === "end") {
      const { error } = await supabase.from("product_images").insert({
        ...row,
        sort_order: rows.length ? rows[rows.length - 1].sort_order + 1 : 0,
      });
      if (error) console.error("[bottle-image] insert failed", error.message);
      return !error;
    }

    // Ард нь орох зургуудыг арын талаас нь эхлэн ухраана.
    const tail = rows.slice(BOTTLE_POSITION);
    for (let i = tail.length - 1; i >= 0; i--) {
      await supabase
        .from("product_images")
        .update({ sort_order: BOTTLE_POSITION + 1 + i })
        .eq("id", tail[i].id);
    }
    const head = rows.slice(0, BOTTLE_POSITION);
    for (let i = 0; i < head.length; i++) {
      if (head[i].sort_order !== i) {
        await supabase
          .from("product_images")
          .update({ sort_order: i })
          .eq("id", head[i].id);
      }
    }

    const { error } = await supabase.from("product_images").insert({
      ...row,
      sort_order: Math.min(rows.length, BOTTLE_POSITION),
    });
    if (error) console.error("[bottle-image] insert failed", error.message);
    return !error;
  } catch (e) {
    console.error("[bottle-image]", e);
    return false;
  }
}

/**
 * Засах хуудаснаас савны зургийг солих / хасах. Хуучин савны зураг(ууд)-ын
 * байранд шинийг нь тавина (байхгүй бол хамгийн ард), харагдах эсэхийг нь
 * өвлүүлнэ. Шинэ мөр орсны ДАРАА хуучныг устгана — дундаас нь бүтэлгүйтвэл
 * бараа савны зураггүй үлдэхгүй.
 */
export async function replaceBottleImage(
  supabase: SupabaseClient,
  productId: string,
  slug: string,
  style: BottleStyle | null,
): Promise<boolean> {
  const { data, error: readErr } = await supabase
    .from("product_images")
    .select("id, url, sort_order, is_visible")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (readErr) return false;
  const rows =
    (data as
      | { id: string; url: string; sort_order: number; is_visible: boolean }[]
      | null) ?? [];
  const old = rows.filter((r) => isBottleImageUrl(r.url));

  if (style) {
    const path = await copyBottleMaster(supabase, slug, style);
    if (!path) return false;
    const { error } = await supabase.from("product_images").insert({
      product_id: productId,
      url: publicUrl(path),
      alt: BOTTLE_STYLE_LABEL[style],
      is_visible: old[0]?.is_visible ?? true,
      sort_order:
        old[0]?.sort_order ??
        (rows.length ? rows[rows.length - 1].sort_order + 1 : 0),
    });
    if (error) {
      console.error("[bottle-image] insert failed", error.message);
      await deleteImage(path);
      return false;
    }
  }

  for (const r of old) {
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", r.id)
      .eq("product_id", productId);
    if (error) return false;
    const p = storagePath(r.url);
    if (p) await deleteImage(p);
  }
  return true;
}
