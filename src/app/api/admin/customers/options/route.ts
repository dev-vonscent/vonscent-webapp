import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/lib/auth/guard";
import { getCustomerOptions } from "@/features/admin/api";
import { isSupabaseConfigured } from "@/lib/env";
import { CUSTOMER_OPTION_LIMIT } from "@/features/admin/lib/customer-option";

const query = z.object({
  q: z.string().trim().max(100).default(""),
});

/**
 * Хэрэглэгчийн сонгогчийн хайлт (хувийн купоны эзэн).
 *
 * Эрхийн шалгалт middleware-ээс ГАДНА энд давтагдаж байгаа нь зориудынх
 * (development.md §7.5): хариунд утасны дугаар орж ирдэг.
 */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ items: [] });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const parsed = query.safeParse({ q: searchParams.get("q") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const items = await getCustomerOptions({
    q: parsed.data.q,
    limit: CUSTOMER_OPTION_LIMIT,
  });
  return NextResponse.json({ items });
}
