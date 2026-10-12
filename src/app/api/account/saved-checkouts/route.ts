import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SAVED_CHECKOUTS_MAX } from "@/lib/constants";
import {
  SAVED_CHECKOUT_MAX_BYTES,
  savedCheckoutInputSchema,
} from "@/lib/validators/saved-checkout";

/**
 * «Дараа авахаар хадгалах» (0116) — нэвтэрсэн хэрэглэгчийн хадгалсан
 * захиалгууд. Сессийн клиент: RLS (`user_id = auth.uid()`) нь эзэмшлийг
 * барина, service role хэрэггүй.
 */

const SELECT = "id, buy_now, items, collections, draft, created_at";
const NO_STORE = { "Cache-Control": "private, no-store" };

async function sessionUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ saved: [] });
  const { supabase, user } = await sessionUser();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_checkouts")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(SAVED_CHECKOUTS_MAX);
  if (error) return NextResponse.json({ error: "DB" }, { status: 500 });
  return NextResponse.json({ saved: data ?? [] }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured)
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  const { supabase, user } = await sessionUser();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  if (!user)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > SAVED_CHECKOUT_MAX_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const parsed = savedCheckoutInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const input = parsed.data;

  const { data, error } = await supabase
    .from("saved_checkouts")
    .insert({
      user_id: user.id,
      buy_now: input.buyNow,
      items: input.items,
      collections: input.collections,
      draft: input.draft,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "DB" }, { status: 500 });
  }

  // Дээд тооноос хэтэрсэн хуучныг хасна — хадгалалт нь хэзээ ч бүтэлгүйтэхгүй,
  // жагсаалт нь хязгааргүй өсөхгүй.
  const { data: overflow } = await supabase
    .from("saved_checkouts")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(SAVED_CHECKOUTS_MAX, SAVED_CHECKOUTS_MAX + 50);
  const stale = (overflow ?? []).map((r: { id: string }) => r.id);
  if (stale.length > 0) {
    await supabase.from("saved_checkouts").delete().in("id", stale);
  }

  return NextResponse.json({ saved: data }, { status: 201 });
}
