import { NextResponse } from "next/server";
import { reviewEligibilitySchema } from "@/lib/validators/review";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isSupabaseConfigured } from "@/lib/env";
import { reviewPointsOf } from "@/lib/loyalty";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewRejectReason, ReviewStatus } from "@/lib/constants";
import type {
  ReviewBlockReason,
  ReviewEligibility,
} from "@/features/reviews/types";

export const dynamic = "force-dynamic";

/**
 * Хяналттай сэтгэгдлийн форм (0162, туг `review_moderation`): энэ хэрэглэгч
 * энэ ус/багцад бичиж болох эсэх, өөрийн сэтгэгдлийн төлөв, урамшууллын
 * оноо. Нөхцөл нь `review_block_reason()` — бичих үеийн trigger-тэй ижил.
 */
export async function GET(req: Request) {
  if (!(await isFeatureEnabled("review_moderation"))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const parsed = reviewEligibilitySchema.safeParse({
    productId: searchParams.get("productId") ?? undefined,
    collectionId: searchParams.get("collectionId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const { productId = null, collectionId = null } = parsed.data;

  if (!isSupabaseConfigured) {
    return NextResponse.json<ReviewEligibility>({
      reason: "unauthorized",
      points: 0,
      own: null,
    });
  }
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  }

  const [{ data: loyalty }, own, block] = await Promise.all([
    supabase
      .from("settings")
      .select("value")
      .eq("key", "loyalty")
      .maybeSingle(),
    user
      ? supabase
          .from("reviews")
          .select("rating, body, status, reject_reason, reject_note")
          .eq(
            productId ? "product_id" : "collection_id",
            productId ?? collectionId,
          )
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? admin.rpc("review_block_reason", {
          p_user: user.id,
          p_product: productId,
          p_collection: collectionId,
        })
      : Promise.resolve({ data: "unauthorized", error: null }),
  ]);
  if (block.error) {
    return NextResponse.json({ error: "RPC_FAILED" }, { status: 500 });
  }

  const row = own.data as {
    rating: number;
    body: string | null;
    status: ReviewStatus;
    reject_reason: ReviewRejectReason | null;
    reject_note: string | null;
  } | null;

  return NextResponse.json<ReviewEligibility>({
    reason: (block.data as ReviewBlockReason | null) ?? null,
    points: reviewPointsOf((loyalty as { value?: unknown } | null)?.value),
    own: row
      ? {
          rating: row.rating,
          body: row.body ?? "",
          status: row.status,
          rejectReason: row.reject_reason,
          rejectNote: row.reject_note,
        }
      : null,
  });
}
