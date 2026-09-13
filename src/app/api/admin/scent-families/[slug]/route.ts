import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { scentFamilyUpdateSchema } from "@/lib/validators/scent-family";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { deleteImage, isStorageUrl, storagePath } from "@/lib/storage/storage";

type Guard =
  | { demo: true }
  | { error: "FORBIDDEN" | "NO_DB" }
  | { supabase: NonNullable<ReturnType<typeof createAdminClient>> };

async function guard(): Promise<Guard> {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const };
  return { supabase };
}

function fail(error: "FORBIDDEN" | "NO_DB") {
  return NextResponse.json(
    { error },
    { status: error === "FORBIDDEN" ? 403 : 500 },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const parsed = scentFamilyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error);

  const input = parsed.data;
  const update: Record<string, unknown> = {};
  if (input.label !== undefined) update.label = input.label;
  if (input.iconUrl !== undefined) update.icon_url = input.iconUrl;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  if (!Object.keys(update).length) return NextResponse.json({ ok: true });

  const { error } = await g.supabase
    .from("scent_families")
    .update(update)
    .eq("slug", slug);
  if (error)
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

/**
 * Төрлийг бүрмөсөн устгах.
 *
 * Хоёр шатлалтай: бараан дээр ашиглагдаж байгаа төрлийг эхний дуудлагад
 * УСТГАХГҮЙ, харин 409 + хэдэн бараанд байгаа тоог буцаана. Админ тоог хараад
 * зөвшөөрвөл `?force=1`-ээр дахин дуудна — тэгэхэд slug нь бараа бүрээс
 * хасагдаад мөр устана (`delete_scent_family`, 0078: нэг гүйлгээ).
 *
 * Нуух (`isActive=false`) нь энэ үйлдлийн зөөлөн хувилбар бөгөөд хэвээр:
 * устгалт нь эргэж сэргээгдэхгүй тул хоёул хэрэгтэй.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const force = new URL(req.url).searchParams.get("force") === "1";
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error);

  const { data: family } = await g.supabase
    .from("scent_families")
    .select("icon_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!family) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { count } = await g.supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .contains("scent_families", [slug]);
  const inUse = count ?? 0;
  if (inUse > 0 && !force) {
    return NextResponse.json(
      { error: "IN_USE", products: inUse },
      { status: 409 },
    );
  }

  const { error } = await callRpc<number>(
    g.supabase,
    "delete_scent_family",
    { p_slug: slug },
  );
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });

  // Өөрсдийн bucket дахь дүрсийг араас нь цэвэрлэнэ — мөр нь алга болсон
  // хойно түүнийг хэн ч хэрэглэхгүй. Repo доторх `/family-*.png` замд хүрэхгүй.
  const iconUrl = (family as { icon_url: string | null }).icon_url;
  if (iconUrl && isStorageUrl(iconUrl)) {
    const path = storagePath(iconUrl);
    if (path) await deleteImage(path);
  }

  revalidatePublic();
  return NextResponse.json({ ok: true, products: inUse });
}
