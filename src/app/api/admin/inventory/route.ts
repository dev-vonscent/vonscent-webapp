import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { getStaffUser } from "@/lib/auth/guard";

const schema = z
  .object({
    productId: z.string().min(1),
    /** + = нөхөлт, − = залруулга (0047_inventory_correction_floor). */
    delta: z.number().int(),
    reason: z.string().default("restock"),
    /** What the added ml cost to buy (₮) — feeds the profit report. */
    cost: z.number().int().nonnegative().default(0),
  })
  // A 0 delta writes a restock_log row that moves nothing but still lands in
  // the profit report; there is no operator intent it can express.
  .refine((v) => v.delta !== 0, {
    message: "Хэмжээ 0 байж болохгүй.",
    path: ["delta"],
  })
  // Removing ml has no purchase cost, and a cost booked against a negative
  // delta would inflate зардал in the profit report.
  .refine((v) => v.delta > 0 || v.cost === 0, {
    message: "Хасалтад өртөг бүртгэхгүй.",
    path: ["cost"],
  })
  // A correction the operator cannot explain is unauditable: restock_log is
  // the only record of why the shop's ml count moved without a sale.
  .refine((v) => v.delta > 0 || v.reason.trim().length > 0, {
    message: "Хасах шалтгаанаа бичнэ үү.",
    path: ["reason"],
  });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // The operator's own words, not "VALIDATION": this route is only ever
    // called from the stock dialog, where the message is shown as a toast.
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Утга буруу байна." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json(
      { error: "Танд энэ үйлдлийг хийх эрх алга." },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Мэдээллийн сантай холбогдож чадсангүй." },
      { status: 500 },
    );
  }

  const { error } = await callRpc(supabase, "restock_inventory", {
    p_product: parsed.data.productId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
    p_by: staff.id,
    p_cost: parsed.data.cost,
  });
  if (error) {
    // The one rejection the operator can act on: they tried to remove ml that
    // are already promised to a paid order. Anything else is a real fault.
    if (error.message.includes("RESERVED_FLOOR")) {
      return NextResponse.json(
        {
          error:
            "Захиалагдсан мл-ээс доош хасах боломжгүй. Эхлээд холбогдох захиалгыг цуцлах эсвэл гүйцэтгэнэ үү.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Үлдэгдэл хадгалагдсангүй. Дахин оролдоно уу." },
      { status: 500 },
    );
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
