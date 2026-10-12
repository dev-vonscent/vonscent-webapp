import { NextResponse } from "next/server";
import { z } from "zod";
import { orderIdForToken } from "@/features/payment/api";
import { revalidatePublic } from "@/lib/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { isQpayMockMode } from "@/lib/payments/qpay";
import { cancelOrderInvoice } from "@/lib/payments/cancel-invoice";
import { verifyAndMarkOrderPaid } from "@/lib/payments/confirm-order";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Төлбөрийн хуудасны «Дараа захиалах» / «Устгах» (0124, клиент 2026-10).
 *
 * Хоёулаа төлөгдөөгүй захиалгыг цуцалж нөөцийг нь суллана; «Дараа захиалах»
 * нь өмнө нь сагсны хуулбарыг «Миний захиалга» → «Дараа захиалах» руу хийнэ.
 * Төлөгдөөгүй цуцлалт админд харагдахгүй, мэдэгдэл ч очихгүй (0124) —
 * мөнгө ороогүй тул хийх ажил алга.
 *
 * Эрх: `pay_token` нь зочны захиалгад хангалттай (тэр л нээж чадна).
 * Бүртгэлтэй захиалгын линк бусдад дамжиж болох тул тэнд эзэмшигч өөрөө
 * нэвтэрсэн байх ёстой.
 */
const bodySchema = z.object({
  token: z.string().min(8).max(128),
  saveForLater: z.boolean(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const { token, saveForLater } = parsed.data;

  const limited = await enforceRateLimit("order", req);
  if (limited) return limited;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const ref = await orderIdForToken(token);
  if (!ref) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (ref.paid) return NextResponse.json({ paid: true });

  const { data } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", ref.id)
    .maybeSingle();
  const ownerId = (data as { user_id: string | null } | null)?.user_id ?? null;

  if (ownerId || saveForLater) {
    const session = await createClient();
    const user = session ? (await session.auth.getUser()).data.user : null;
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (user.id !== ownerId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  // Цуцлахаас өмнө QPay-ээс асууна: банкны апп дээр төлчихөөд буцаж ирж
  // «Устгах» дарсан хүний мөнгө цуцлагдсан захиалга дээр үлдэх ёсгүй.
  // Шалгаж чадаагүй (QPay унасан) бол цуцлахгүй — дахин оролдуулна.
  if (!isQpayMockMode()) {
    const check = await verifyAndMarkOrderPaid(ref.id);
    if (check.ok) return NextResponse.json({ paid: true });
    if (check.error === "CHECK_FAILED") {
      return NextResponse.json({ error: "CHECK_FAILED" }, { status: 503 });
    }
  }

  const { data: abandoned, error } = await callRpc<boolean>(
    admin,
    "abandon_unpaid_order",
    {
      p_order: ref.id,
      p_save: saveForLater,
      p_note: saveForLater ? "Дараа захиалах руу шилжүүлсэн" : "Хэрэглэгч устгасан",
      p_by: ownerId,
    },
  );
  if (error) {
    return NextResponse.json({ error: "ABANDON_FAILED" }, { status: 500 });
  }
  // false = энэ хооронд төлөгдсөн эсвэл аль хэдийн цуцлагдсан.
  if (!abandoned) {
    const fresh = await orderIdForToken(token);
    if (fresh?.paid) return NextResponse.json({ paid: true });
    return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
  }

  // Утсан дээр нээлттэй үлдсэн QR цуцлагдсан захиалгад мөнгө оруулахгүй.
  await cancelOrderInvoice(ref.id);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
