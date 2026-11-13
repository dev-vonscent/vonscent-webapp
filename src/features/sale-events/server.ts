import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SaleEventInput } from "@/lib/validators/sale-event";
import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import { overlapConflicts, overlapMessage, type OverlapConflict } from "./lib";

/**
 * Админы арга хэмжээний route бүрийн хаалга (plan §12): туг (404) → staff
 * (403) → service-role. Zod-ыг route өөрөө шалгана. RPC-ууд тугийг SQL талд
 * ДАХИН шалгана (`FEATURE_DISABLED`).
 */
export async function saleEventAdminGate() {
  if (!(await isFeatureEnabled("sale_events"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const staff = await getStaffUser();
  if (!staff) {
    return {
      response: NextResponse.json(
        { error: "Эрх баталгаажсангүй. Хуудсаа сэргээгээд дахин нэвтэрнэ үү." },
        { status: 403 },
      ),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { supabase, staff } as const;
}

/**
 * Маягт → `save_sale_event(p_data, p_items)`. Өдрүүд УБ-ийн хил:
 * эхлэх өдрийн 00:00, дуусах өдрийн ДАРААХ 00:00 (exclusive, 0181).
 */
export function toSaleEventRpc(input: SaleEventInput) {
  return {
    p_data: {
      slug: input.slug,
      name: input.name,
      badgeLabel: input.badgeLabel,
      headline: input.headline,
      description: input.description,
      startsAt: dayStartIso(input.startsOn),
      endsAt: dayEndIso(input.endsOn),
      isActive: input.isActive,
      showCountdown: input.showCountdown,
    },
    p_items: input.items.map((i) => ({ productId: i.productId, pcts: i.pcts })),
  };
}

/**
 * Сангийн алдаа → админд харагдах хариу. Давхцал 409 + бараануудын жагсаалт
 * (`conflicts` — маягт улаанаар тэмдэглэнэ), slug давхардал 409.
 */
export function saleEventWriteError(error: {
  message: string;
  details?: string | null;
  code?: string;
}) {
  if (/EVENT_OVERLAP/.test(error.message)) {
    const conflicts: OverlapConflict[] = overlapConflicts(error.details);
    return NextResponse.json(
      { error: overlapMessage(conflicts), conflicts },
      { status: 409 },
    );
  }
  if (error.code === "23505" || /duplicate key/i.test(error.message)) {
    return NextResponse.json(
      {
        error:
          "Энэ холбоос өөр явж буй, товлосон эсвэл ноорог арга хэмжээнд байна. Өөр холбоос сонгоно уу.",
      },
      { status: 409 },
    );
  }
  if (/EVENT_ENDED/.test(error.message)) {
    return NextResponse.json(
      {
        error:
          "Дууссан арга хэмжээг засахгүй. Дахин явуулах бол хуулж шинээр үүсгэнэ үү.",
      },
      { status: 409 },
    );
  }
  if (/FEATURE_DISABLED/.test(error.message)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (/NOT_FOUND/.test(error.message)) {
    return NextResponse.json(
      { error: "Арга хэмжээ олдсонгүй." },
      { status: 404 },
    );
  }
  if (/NOT_DRAFT/.test(error.message)) {
    return NextResponse.json(
      {
        error:
          "Нийтэлсэн арга хэмжээг устгахгүй — зогсооно уу (түүх нь үлдэнэ).",
      },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: "Хадгалж чадсангүй. Дахин оролдоно уу." },
    { status: 500 },
  );
}
