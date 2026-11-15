import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { saleEventInputSchema } from "@/lib/validators/sale-event";
import {
  saleEventAdminGate,
  saleEventWriteError,
  toSaleEventRpc,
} from "@/features/sale-events/server";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/**
 * Бүтэн засвар — гишүүд, хувь бүрэн солигдоно. Явж буй арга хэмжээг засвал
 * дэлгүүрт ШУУД нөлөөлнө (маягт өмнө нь баталгаажуулна).
 */
export async function PUT(req: Request, { params }: Ctx) {
  const gate = await saleEventAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = saleEventInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!id.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }

  const { error } = await gate.supabase.rpc("save_sale_event", {
    p_id: id.data,
    ...toSaleEventRpc(parsed.data),
    p_user: gate.staff.id,
  });
  if (error) return saleEventWriteError(error);
  revalidatePublic();
  return NextResponse.json({ id: id.data });
}

const actionSchema = z.object({ action: z.literal("stop") });

/**
 * «Зогсоох» — устгахгүй, түүх үлдэнэ (`stop_sale_event`): явж буй бол яг
 * одоо дуусна, эхлээгүй бол ноорог руу буцна.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await saleEventAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { error } = await gate.supabase.rpc("stop_sale_event", {
    p_id: id.data,
  });
  if (error) return saleEventWriteError(error);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

/** Устгах — зөвхөн ноорог (`delete_sale_event`). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await saleEventAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { error } = await gate.supabase.rpc("delete_sale_event", {
    p_id: id.data,
  });
  if (error) return saleEventWriteError(error);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
