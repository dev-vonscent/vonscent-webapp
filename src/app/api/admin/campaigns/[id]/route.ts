import { NextResponse } from "next/server";
import { z } from "zod";
import {
  campaignInputSchema,
  campaignToggleSchema,
} from "@/lib/validators/campaign";
import {
  campaignAdminGate,
  campaignWriteError,
  toCampaignColumns,
} from "@/features/campaigns/server";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** Бүх тохиргоог засах. Олгосон купон хуучин нөхцөлөөрөө хэвээр үлдэнэ. */
export async function PUT(req: Request, { params }: Ctx) {
  const gate = await campaignAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = campaignInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("campaigns")
    .update(toCampaignColumns(parsed.data))
    .eq("id", id.data)
    .select("id");
  if (error) return campaignWriteError(error.message);
  if (!data?.length) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Асаах / унтраах. */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await campaignAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = campaignToggleSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!id.success || !parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("campaigns")
    .update({ is_active: parsed.data.isActive })
    .eq("id", id.data)
    .select("id");
  if (error) return campaignWriteError(error.message);
  if (!data?.length) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Устгах — зөвхөн нэг ч купон олгоогүй (андуурч үүсгэсэн) бол. Олгосон
 * кампанит ажил нь тайлан, утасны давхардлын хамгаалалтад хэрэгтэй тул
 * унтраана (`campaign_grants` FK нь `restrict`).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await campaignAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const { count } = await gate.supabase
    .from("campaign_grants")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id.data);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "Купон олгосон кампанит ажлыг устгах боломжгүй — унтраана уу.",
      },
      { status: 409 },
    );
  }

  const { error } = await gate.supabase
    .from("campaigns")
    .delete()
    .eq("id", id.data);
  if (error) return campaignWriteError(error.message);
  return NextResponse.json({ ok: true });
}
