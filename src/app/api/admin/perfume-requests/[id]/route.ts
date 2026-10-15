import { NextResponse } from "next/server";
import { z } from "zod";
import { perfumeRequestAdminGate } from "@/features/perfume-requests/server";
import type { AdminPerfumeRequestVoter } from "@/features/perfume-requests/types";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** Санал өгсөн хүмүүс — админы дэлгэрэнгүй (худалдан авалтын шийдвэрт). */
export async function GET(_req: Request, { params }: Ctx) {
  const gate = await perfumeRequestAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("perfume_request_votes")
    .select("user_id, note, created_at")
    .eq("request_id", id.data)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    return NextResponse.json(
      { error: "Ачаалж чадсангүй. Дахин оролдоно уу." },
      { status: 500 },
    );
  }
  const votes =
    (data as
      | { user_id: string; note: string | null; created_at: string }[]
      | null) ?? [];

  // `perfume_request_votes.user_id` нь auth.users руу заадаг (profiles руу FK
  // байхгүй) тул embed хийж болохгүй — тусад нь нэг асуулгаар.
  const ids = votes.map((v) => v.user_id);
  const { data: profiles } = ids.length
    ? await gate.supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids)
    : { data: [] };
  const byId = new Map(
    (
      (profiles as
        | { id: string; full_name: string | null; phone: string | null }[]
        | null) ?? []
    ).map((p) => [p.id, p]),
  );

  const voters: AdminPerfumeRequestVoter[] = votes.map((v) => ({
    userId: v.user_id,
    name: byId.get(v.user_id)?.full_name ?? null,
    phone: byId.get(v.user_id)?.phone ?? null,
    note: v.note,
    votedAt: v.created_at,
  }));
  return NextResponse.json({ voters });
}
