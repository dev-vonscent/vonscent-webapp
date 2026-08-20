import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";

const schema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),
});

interface CouponResult {
  valid: boolean;
  discount: number;
  reason?: string;
  code?: string;
  minSubtotal?: number;
}

const REASON_MN: Record<string, string> = {
  EMPTY: "Купон код оруулна уу.",
  NOT_FOUND: "Купон код олдсонгүй.",
  INACTIVE: "Энэ купон идэвхгүй байна.",
  NOT_STARTED: "Купон хараахан эхлээгүй байна.",
  EXPIRED: "Купоны хугацаа дууссан байна.",
  MAX_USES: "Купоны ашиглах эрх дууссан байна.",
  MAX_USES_USER: "Та энэ купоныг аль хэдийн ашигласан байна.",
  LOGIN_REQUIRED: "Энэ купоныг ашиглахын тулд нэвтэрнэ үү.",
  MIN_SUBTOTAL: "Захиалгын дүн хүрэхгүй байна.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, discount: 0 }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ valid: false, discount: 0, message: "demo" });
  }

  // The session client answers "who is asking"; the admin client does the
  // lookup so a personal coupon can be checked without exposing the row.
  const session = await createClient();
  const { data: { user } = { user: null } } =
    (await session?.auth.getUser()) ?? { data: { user: null } };

  const supabase = createAdminClient() ?? session;
  if (!supabase) {
    return NextResponse.json({ valid: false, discount: 0 }, { status: 500 });
  }

  const { data, error } = await callRpc<CouponResult>(
    supabase,
    "validate_coupon",
    {
      p_code: parsed.data.code,
      p_subtotal: parsed.data.subtotal,
      p_user: user?.id ?? null,
    },
  );
  if (error || !data) {
    return NextResponse.json({ valid: false, discount: 0 }, { status: 500 });
  }

  return NextResponse.json({
    valid: data.valid,
    discount: data.discount ?? 0,
    code: data.code,
    message: data.valid
      ? undefined
      : (REASON_MN[data.reason ?? ""] ?? "Купон хүчингүй байна."),
  });
}
