import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  revalidateCollectionReviews,
  revalidateProductReviews,
} from "@/lib/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewTarget } from "./types";

/** Purge the page the review lives on — the rows only carry the id. */
export async function revalidateTarget(
  supabase: SupabaseClient,
  target: ReviewTarget,
) {
  const table = target.kind === "product" ? "products" : "collections";
  const { data } = await supabase
    .from(table)
    .select("slug")
    .eq("id", target.id)
    .maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug ?? null;
  if (target.kind === "product") revalidateProductReviews(slug);
  else revalidateCollectionReviews(slug);
}

/**
 * Сэтгэгдлийн хяналтын админ route-ын хаалга (0162): туг (404) → staff (403)
 * → service-role. Service-role нь `reviews_moderation_guard`-ийг тойрно —
 * хяналтын update-ийг зөвхөн ажилтан хийнэ.
 */
export async function reviewAdminGate() {
  if (!(await isFeatureEnabled("review_moderation"))) {
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
