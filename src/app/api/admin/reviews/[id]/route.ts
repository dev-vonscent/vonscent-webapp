import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewModerationSchema } from "@/lib/validators/review";
import { revalidateTarget, reviewAdminGate } from "@/features/reviews/server";
import type { ReviewTarget } from "@/features/reviews/types";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

interface TargetRow {
  product_id: string | null;
  collection_id: string | null;
}

function targetOf(row: TargetRow): ReviewTarget | null {
  if (row.product_id) return { kind: "product", id: row.product_id };
  if (row.collection_id) return { kind: "collection", id: row.collection_id };
  return null;
}

/**
 * Админы хяналт (0162): батлах / цуцлах (шалтгаантай) / сайтад харуулах эсэх /
 * нүүр хуудсанд сонгох. Батлах update нь `reviews_award_points` trigger-ээр
 * оноог өөрөө олгоно (нэг удаа — `review_rewards`); нуух, цуцлах нь олгосон
 * оноог буцаахгүй.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await reviewAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = reviewModerationSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const input = parsed.data;

  const { data: current } = await gate.supabase
    .from("reviews")
    .select("status, product_id, collection_id")
    .eq("id", id.data)
    .maybeSingle();
  const row = current as (TargetRow & { status: string }) | null;
  if (!row) {
    return NextResponse.json(
      { error: "Сэтгэгдэл олдсонгүй." },
      { status: 404 },
    );
  }

  let patch: Record<string, unknown>;
  switch (input.action) {
    case "approve":
    case "reject":
      patch = {
        status: input.action === "approve" ? "approved" : "rejected",
        reject_reason: input.action === "reject" ? input.reason : null,
        // Тайлбар зөвхөн «Бусад»-д (0167); батлахад цэвэрлэгдэнэ.
        reject_note:
          input.action === "reject" && input.reason === "other"
            ? (input.note ?? null)
            : null,
        // Цуцалсан сэтгэгдэл нүүрэнд үлдэхгүй.
        ...(input.action === "reject" && { is_featured: false }),
        moderated_at: new Date().toISOString(),
        moderated_by: gate.staff.id,
      };
      break;
    case "visibility":
      patch = { is_visible: input.visible };
      break;
    case "featured":
      // Нүүрний карт усны зураг/холбоостой — багцын сэтгэгдэл тэнд гарахгүй.
      if (input.featured && (row.status !== "approved" || !row.product_id)) {
        return NextResponse.json(
          { error: "Зөвхөн батлагдсан, усны сэтгэгдлийг нүүрэнд харуулна." },
          { status: 400 },
        );
      }
      patch = { is_featured: input.featured };
      break;
  }

  const { error } = await gate.supabase
    .from("reviews")
    .update(patch)
    .eq("id", id.data);
  if (error) {
    return NextResponse.json(
      { error: "Хадгалж чадсангүй. Дахин оролдоно уу." },
      { status: 500 },
    );
  }

  const target = targetOf(row);
  if (target) await revalidateTarget(gate.supabase, target);
  return NextResponse.json({ ok: true });
}
