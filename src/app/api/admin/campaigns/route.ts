import { NextResponse } from "next/server";
import { campaignInputSchema } from "@/lib/validators/campaign";
import {
  campaignAdminGate,
  campaignWriteError,
  toCampaignColumns,
} from "@/features/campaigns/server";

/** Кампанит ажил үүсгэх. Уншилт нь `getCampaignsAdmin()` (хуудас). */
export async function POST(req: Request) {
  const gate = await campaignAdminGate();
  if ("response" in gate) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = campaignInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("campaigns")
    .insert({ ...toCampaignColumns(parsed.data), created_by: gate.staff.id })
    .select("id")
    .single();
  if (error) return campaignWriteError(error.message);
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
