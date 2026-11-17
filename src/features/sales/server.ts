import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NamedSaleInput } from "@/lib/validators/sale";
import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import type { SalePcts, SaleProductRow, SaleRecord } from "./lib";
import type { Gender } from "@/db/types";

/** Хоёр туг хоёулаа: «Хямдрал» хуудас (0166) + нэртэй хямдрал (0188). */
export async function namedSalesEnabled(): Promise<boolean> {
  const [page, named] = await Promise.all([
    isFeatureEnabled("sale_page"),
    isFeatureEnabled("named_sales"),
  ]);
  return page && named;
}

/**
 * Route бүрийн хаалга: туг (404) → staff (403) → service-role. Zod-ыг route
 * өөрөө шалгана; RPC тугийг SQL талд дахин шалгана (`FEATURE_DISABLED`).
 */
export async function namedSaleGate() {
  if (!(await namedSalesEnabled())) {
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

/** Маягт → `save_sale(...)` (0188). Өдрүүд УБ-ын хил (exclusive төгсгөл). */
export function toSaveSaleRpc(
  id: string | null,
  input: NamedSaleInput,
  actor: string,
) {
  return {
    p_id: id,
    p_name: input.name,
    p_pcts: input.pcts,
    p_starts: dayStartIso(input.startsOn),
    p_ends: dayEndIso(input.endsOn),
    p_product_ids: input.productIds,
    p_adopt_unnamed: input.adoptUnnamed,
    p_actor: actor,
  };
}

function parseDetail<T>(detail: string | null | undefined): T[] {
  try {
    const v = JSON.parse(detail ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Сангийн алдаа → админд харагдах хариу (монголоор). */
export function namedSaleWriteError(error: {
  message: string;
  details?: string | null;
}) {
  const m = error.message;
  if (/SALE_CONFLICT/.test(m)) {
    const conflicts = parseDetail<{ productId: string; sale: string }>(
      error.details,
    );
    return NextResponse.json(
      {
        error:
          "Зарим бараа өөр дуусаагүй хямдралд орсон байна. Тэдгээрийг хасаад дахин хадгална уу.",
        conflicts,
      },
      { status: 409 },
    );
  }
  if (/PRODUCT_WITHOUT_DISCOUNT/.test(m)) {
    return NextResponse.json(
      {
        error:
          "Зарим бараанд хувь өгсөн хэмжээ нь зарагддаггүй тул 4 хэмжээ бүгд хямдралгүй үлдэнэ. Хувь нэмэх эсвэл барааг хасна уу.",
        productIds: parseDetail<string>(error.details),
      },
      { status: 400 },
    );
  }
  const simple: [RegExp, number, string][] = [
    [/FEATURE_DISABLED/, 404, "NOT_FOUND"],
    [/NOT_FOUND/, 404, "Хямдрал олдсонгүй."],
    [/BAD_NAME/, 400, "Хямдралын нэр оруулна уу."],
    [/BAD_PCT/, 400, "Хувь 1–90 хооронд байх ёстой."],
    [/BAD_PERIOD/, 400, "Дуусах өдөр эхлэхээс хойш байх ёстой."],
    [/NO_PRODUCTS/, 400, "Дор хаяж нэг бараа сонгоно уу."],
    [/ALREADY_ENDED/, 409, "Хямдрал аль хэдийн дууссан байна."],
    [
      /NOT_STARTED/,
      409,
      "Эхлээгүй хямдралыг дуусгахгүй — устгах эсвэл хугацааг нь засна уу.",
    ],
  ];
  for (const [re, status, msg] of simple) {
    if (re.test(m)) return NextResponse.json({ error: msg }, { status });
  }
  return NextResponse.json(
    { error: "Хадгалж чадсангүй. Дахин оролдоно уу." },
    { status: 500 },
  );
}

interface ProductRow {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  product_variants: {
    ml: number;
    price: number;
    sale_price: number | null;
    sale_starts_at: string | null;
    sale_ends_at: string | null;
    is_active: boolean;
    sale_id: string | null;
  }[];
}

interface SaleRow {
  id: string;
  name: string;
  pcts: SalePcts | null;
  starts_at: string | null;
  ends_at: string;
}

/**
 * Админы хямдралын хуудсуудын өгөгдөл: нэрт хямдрал + дэлгүүрт харагдаж буй
 * («Идэвхтэй», «Тун удахгүй») бүх бараа, хэмжээний хямдралын баганатай.
 * Admin хуудас force-dynamic тул кэшгүй. Алдааг ШИДНЭ — хоосон жагсаалт
 * «хямдрал байхгүй» мэт харагдаж админыг төөрөгдүүлэхгүй.
 */
export async function getNamedSalesData(): Promise<{
  sales: SaleRecord[];
  products: SaleProductRow[];
}> {
  const supabase = await createClient();
  if (!supabase) return { sales: [], products: [] };
  const [salesRes, productsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, name, pcts, starts_at, ends_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select(
        "id, name, brand, gender, product_variants ( ml, price, sale_price, sale_starts_at, sale_ends_at, is_active, sale_id )",
      )
      .in("status", ["active", "coming_soon"])
      .order("brand")
      .order("name"),
  ]);
  if (salesRes.error) throw new Error(salesRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const sales = ((salesRes.data as SaleRow[] | null) ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    pcts: s.pcts ?? {},
    startsAt: s.starts_at,
    endsAt: s.ends_at,
  }));
  const products = ((productsRes.data as ProductRow[] | null) ?? []).map(
    (r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      gender: r.gender,
      variants: [...r.product_variants]
        .sort((a, b) => a.ml - b.ml)
        .map((v) => ({
          ml: v.ml,
          price: v.price,
          salePrice: v.sale_price,
          saleStartsAt: v.sale_starts_at,
          saleEndsAt: v.sale_ends_at,
          isActive: v.is_active,
          saleId: v.sale_id,
        })),
    }),
  );
  return { sales, products };
}
