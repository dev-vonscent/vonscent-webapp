import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { callRpc } from "@/lib/supabase/rpc";
import { perfumeRequestMergeSchema } from "@/lib/validators/perfume-request";
import { perfumeRequestAdminGate } from "@/features/perfume-requests/server";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/**
 * Давхардсан саналыг нэгтгэх: `[id]`-ийн саналууд `targetId` руу шилжиж,
 * `[id]` устана (0137 `merge_perfume_requests`). Бичлэгийн алдаа
 * («Sauvag», «Dior Savage») түлхүүрээр баригдаагүй үед.
 */
export async function POST(req: Request, { params }: Ctx) {
  const gate = await perfumeRequestAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = perfumeRequestMergeSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!id.success || !parsed.success || id.data === parsed.data.targetId) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const { data, error } = await callRpc<number>(
    gate.supabase,
    "merge_perfume_requests",
    { p_source: id.data, p_target: parsed.data.targetId },
  );
  if (error) {
    if (error.message.includes("NOT_FOUND")) {
      return NextResponse.json(
        { error: "Санал олдсонгүй. Хуудсаа сэргээнэ үү." },
        { status: 404 },
      );
    }
    Sentry.captureException(
      new Error(`merge_perfume_requests: ${error.message}`),
    );
    return NextResponse.json(
      { error: "Нэгтгэх үед алдаа гарлаа. Дахин оролдоно уу." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, voteCount: data ?? 0 });
}
