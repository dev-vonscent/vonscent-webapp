import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { vialAdminGate } from "@/features/extras/vial-route";

const schema = z.object({
  lowThreshold: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
  note: z.string().trim().max(200).optional(),
});

/** «Цөөхөн гэж анхааруулах тоо», «Түр хаах», тэмдэглэл. Тоо биш. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await vialAdminGate();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { lowThreshold, isActive, note } = parsed.data;
  const { error } = await gate.supabase
    .from("vials")
    .update({
      ...(lowThreshold === undefined ? {} : { low_threshold: lowThreshold }),
      ...(isActive === undefined ? {} : { is_active: isActive }),
      ...(note === undefined ? {} : { note }),
      updated_by: gate.staff.id,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Хадгалж чадсангүй." }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
