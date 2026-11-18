import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { saleEventInputSchema } from "@/lib/validators/sale-event";
import {
  saleEventAdminGate,
  saleEventBundleGate,
  saleEventWriteError,
  toSaleEventRpc,
} from "@/features/sale-events/server";

export const dynamic = "force-dynamic";

/** Шинэ арга хэмжээ (ноорог эсвэл шууд нийтлэх) — `save_sale_event` (0181). */
export async function POST(req: Request) {
  const gate = await saleEventAdminGate();
  if ("response" in gate) return gate.response;

  const parsed = saleEventInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }

  const bundleBlock = await saleEventBundleGate(gate.supabase, parsed.data);
  if (bundleBlock) return bundleBlock;

  const { data, error } = await gate.supabase.rpc("save_sale_event", {
    p_id: null,
    ...toSaleEventRpc(parsed.data),
    p_user: gate.staff.id,
  });
  if (error) return saleEventWriteError(error);
  revalidatePublic();
  return NextResponse.json({ id: data as string });
}
