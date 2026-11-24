import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  LABEL_PRINT_MAX,
  LABEL_PRINTABLE_ORDER_STATUSES,
} from "@/lib/constants";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(LABEL_PRINT_MAX),
  /** address → label_printed_at, perfume → perfume_label_printed_at (0202). */
  kind: z.enum(["address", "perfume"]).default("address"),
});

/**
 * Хаягийн эсвэл усны шошго хэвлэгдсэнийг тэмдэглэнэ (0202) —
 * зөвхөн ажилтан.
 *
 * Хэвлэлт өөрөө браузерт (Web Bluetooth) явагдана; энд зөвхөн хэвлэгчээс
 * амжилттай хариу ирсэн захиалгуудын цагийг бичнэ. Дахин хэвлэвэл цаг
 * шинэчлэгдэнэ. Төлөвийн шүүлт UPDATE дотроо — зэрэг цуцлалт орж ирэхгүй.
 */
export async function POST(req: Request) {
  if (!(await isFeatureEnabled("label_print"))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data, error } = await supabase
    .from("orders")
    .update({
      [parsed.data.kind === "perfume"
        ? "perfume_label_printed_at"
        : "label_printed_at"]: new Date().toISOString(),
    })
    .in("id", parsed.data.ids)
    .in("status", [...LABEL_PRINTABLE_ORDER_STATUSES])
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
