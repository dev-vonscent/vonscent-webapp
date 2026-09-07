import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/guard";
import { getProductOptions } from "@/features/admin/api";
import { isSupabaseConfigured } from "@/lib/env";
import { PRODUCT_OPTION_LIMIT } from "@/features/admin/lib/product-option";

/**
 * Барааны сонгогчийн хайлт (бэлгийн сан, нүүрийн хэсэг, багцын форм).
 *
 * Эдгээр дэлгэц өмнө нь бүх каталогийг props-оор хүлээж авдаг байсан; одоо
 * бичсэн үсэг бүрд эндээс эхний хэдэн илэрцээ уншина.
 *
 * Эрхийн шалгалт middleware-ээс ГАДНА энд давтагдаж байгаа нь зориудынх
 * (development.md §7.5): нуусан бараа энэ хариунд орж ирдэг.
 */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ items: [] });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || PRODUCT_OPTION_LIMIT, 1),
    100,
  );
  const items = await getProductOptions({ q, limit });
  return NextResponse.json({ items });
}
