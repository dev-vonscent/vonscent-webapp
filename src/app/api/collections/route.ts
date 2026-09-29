import { NextResponse } from "next/server";
import { z } from "zod";
import { getBaseCollections } from "@/features/collections/api";

const querySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Идэвхтэй бэлэн багцууд id-гаар — хүслийн жагсаалтын хуудас (0107) уншина.
 * Нийтийн өгөгдөл (`getBaseCollections` нь anon client, кэштэй); custom
 * багц хэзээ ч буцахгүй.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const parsed = querySchema.safeParse({
    ids: raw.split(",").filter(Boolean),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const wanted = new Set(parsed.data.ids);
  const items = (await getBaseCollections()).filter((c) => wanted.has(c.id));
  return NextResponse.json({ items });
}
