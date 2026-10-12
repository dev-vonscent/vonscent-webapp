import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";

/**
 * Хэрэглэгчийн хугацаа нь дууссан, төлөгдөөгүй захиалгыг ОДОО «Дараа
 * захиалах» руу шилжүүлнэ (0124).
 *
 * Ердийн зам нь pg_cron (`release_expired_reserves`, 5 минут тутам) — тэр
 * ажиллах хүртэл «Миний захиалга» жагсаалт «Хүлээгдэж буй» гэж харуулж,
 * дэлгэрэнгүй нь хэдэн минутын дараа «Цуцлагдсан» болдог байв (клиент,
 * 2026-10: «рийл тайм төлөв нь холбогдоогүй»). Хуудас уншихаасаа өмнө
 * үүнийг дуудвал жагсаалт, дэлгэрэнгүй хоёр нэг үнэнийг харуулна.
 *
 * Cron-той ижил дүрэм: `reserve_expires_at` өнгөрсөн (35 минут — төлбөр
 * тулгалтын зөрүүтэй, constants.ts), ижил RPC, ижил тэмдэглэл. Зөвхөн энэ
 * хэрэглэгчийнх — бусдын захиалгыг хөдөлгөхгүй.
 */
export async function settleExpiredOrders(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    .lt("reserve_expires_at", new Date().toISOString());
  for (const { id } of (data as { id: string }[] | null) ?? []) {
    await callRpc(admin, "abandon_unpaid_order", {
      p_order: id,
      p_save: true,
      p_note: "Захиалгын хугацаа дууссан",
      p_by: null,
    });
  }
}
