import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  code: z.string().trim().min(1).max(40),
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
  LOGIN_REQUIRED: "Купон ашиглахын тулд нэвтэрнэ үү.",
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

  // Код таах оролдлогыг сааруулна. Түлхүүр нь IP: халдагч данс солиод л
  // дахин эхлүүлэх боломжтой тул хэрэглэгчийн id энд хамгаалалт болохгүй.
  const limited = await enforceRateLimit("coupon", req);
  if (limited) return limited;

  // Купон зөвхөн бүртгэлтэй хэрэглэгчид (0104). RPC ч мөн зочинд татгалздаг,
  // гэхдээ энд эрт буцаах нь кодыг огт хайлгахгүй.
  const session = await createClient();
  const { data: { user } = { user: null } } =
    (await session?.auth.getUser()) ?? { data: { user: null } };
  if (!user) {
    return NextResponse.json(
      {
        valid: false,
        discount: 0,
        reason: "LOGIN_REQUIRED",
        message: REASON_MN.LOGIN_REQUIRED,
      },
      { status: 401 },
    );
  }

  // validate_coupon нь service_role-д л нээлттэй (0104) — session руу унах
  // зам байхгүй.
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ valid: false, discount: 0 }, { status: 500 });
  }

  const { data, error } = await callRpc<CouponResult>(
    supabase,
    "validate_coupon",
    {
      p_code: parsed.data.code,
      p_subtotal: parsed.data.subtotal,
      p_user: user.id,
    },
  );
  if (error || !data) {
    return NextResponse.json({ valid: false, discount: 0 }, { status: 500 });
  }

  return NextResponse.json({
    valid: data.valid,
    discount: data.discount ?? 0,
    code: data.code,
    reason: data.valid ? undefined : data.reason,
    message: data.valid
      ? undefined
      : (REASON_MN[data.reason ?? ""] ?? "Купон хүчингүй байна."),
  });
}
