import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET, publicUrl } from "@/lib/storage/storage";
import { BOTTLE_STYLE_LABEL, type BottleStyle } from "@/lib/constants";

/**
 * Савны зургийн эх хувь — Storage-д `scripts/upload-bottle-images.ts`
 * оруулна.
 */
export const BOTTLE_MASTER_PATH = (s: BottleStyle) => `bottles/${s}.webp`;

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
 */
export async function addBottleImage(
  supabase: SupabaseClient,
  productId: string,
  slug: string,
  style: BottleStyle,
  placement: "third" | "end",
): Promise<void> {
  try {
    const path = `products/${slug}/bottle-${randomUUID()}.webp`;
    const { error: copyErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .copy(BOTTLE_MASTER_PATH(style), path);
    if (copyErr) {
      console.error("[bottle-image] copy failed", copyErr.message);
      return;
    }

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
      await supabase.from("product_images").insert({
        ...row,
        sort_order: rows.length ? rows[rows.length - 1].sort_order + 1 : 0,
      });
      return;
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

    await supabase.from("product_images").insert({
      ...row,
      sort_order: Math.min(rows.length, BOTTLE_POSITION),
    });
  } catch (e) {
    console.error("[bottle-image]", e);
  }
}
