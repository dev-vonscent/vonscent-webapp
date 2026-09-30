import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { getAdminProducts } from "@/features/admin/api";
import { ubDateKey, ubIso, ubIsoEnd } from "@/features/admin/lib/date-range";
import { QPAY_FEE_PCT } from "@/lib/constants";

/** `admin_report_events`-ийн мөр (0111) — борлуулалт (+) ба буцаалт (−). */
interface EventRow {
  order_no: string;
  kind: "sale" | "refund";
  at: string;
  contact_name: string;
  status: string;
  payment_method: string;
  goods: number;
  coupon: number;
  points: number;
  net_goods: number;
  shipping: number;
  cash: number;
  qpay_fee: number;
  refund_fee: number;
}

/**
 * PostgREST нэг хариунд `max_rows` (1000) мөр л өгнө — өмнө нь үүнээс олон
 * захиалгатай муж CSV дээр чимээгүй тасардаг байв. Хуудаслаж бүгдийг авна.
 */
const PAGE = 1000;

function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const type = params.get("type") ?? "sales";
  // Татсан файл нь дэлгэц дээр харж байсан мужтай ижил байх ёстой — өмнө нь
  // шүүлт хэрэглэсэн ч экспорт үргэлж БҮХ цаг үеийг өгдөг байв.
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  let rows: (string | number)[][] = [];

  // Тайлангийн RPC-ууд `is_staff()`-оор хаалттай тул сессийн client.
  const supabase = await createClient();
  const range = { p_from: ubIso(from) ?? null, p_to: ubIsoEnd(to) ?? null };

  if (type === "products") {
    // Дэлгэц дээр top 10, файлд бүгд.
    const { data } = supabase
      ? await supabase.rpc("admin_report_top_products", {
          p_limit: 100_000,
          ...range,
        })
      : { data: [] };
    const top =
      (data as
        | { name: string; brand: string; qty: number; revenue: number }[]
        | null) ?? [];
    rows = [
      ["Брэнд", "Нэр", "Тоо", "Барааны дүн (купоноос өмнө)"],
      ...top.map((p) => [p.brand, p.name, p.qty, p.revenue]),
    ];
  } else if (type === "inventory") {
    const products = await getAdminProducts();
    rows = [
      ["Брэнд", "Нэр", "Үлдэгдэл (ml)", "Доод хязгаар", "Идэвхтэй"],
      ...products.map((p) => [
        p.brand,
        p.name,
        p.availableMl,
        p.lowStockMl,
        p.isActive ? "Тийм" : "Үгүй",
      ]),
    ];
  } else {
    // sales — дэлгэц дээрх «Цэвэр борлуулалт» нь энэ файлын «Цэвэр
    // борлуулалт» баганын нийлбэр (нэг RPC, 0111).
    const events: EventRow[] = [];
    for (let offset = 0; supabase; offset += PAGE) {
      const { data, error } = await supabase
        .rpc("admin_report_events", { ...range, p_qpay_pct: QPAY_FEE_PCT })
        .range(offset, offset + PAGE - 1);
      if (error) {
        return NextResponse.json({ error: "EXPORT_FAILED" }, { status: 500 });
      }
      const page = (data as EventRow[] | null) ?? [];
      events.push(...page);
      if (page.length < PAGE) break;
    }
    rows = [
      [
        "Төрөл",
        "Дугаар",
        "Огноо",
        "Хэрэглэгч",
        "Барааны дүн",
        "Купон",
        "V-point",
        "Цэвэр борлуулалт",
        "Хүргэлт",
        "Дансанд орсон / буцаасан",
        "QPay шимтгэл",
        "Буцаалтын шимтгэл",
        "Төлбөрийн хэлбэр",
        "Төлөв",
      ],
      ...events.map((e) => [
        e.kind === "sale" ? "Борлуулалт" : "Буцаалт",
        e.order_no,
        // Огноо нь дэлгүүрийн бүсээр — `toISOString()` нь UTC.
        ubDateKey(new Date(e.at)),
        e.contact_name,
        e.goods,
        e.coupon,
        e.points,
        e.net_goods,
        e.shipping,
        e.cash,
        e.qpay_fee,
        e.refund_fee,
        e.payment_method,
        e.status,
      ]),
    ];
  }

  const csv = "﻿" + toCsv(rows); // BOM for Excel UTF-8
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Файлын нэрэнд муж нь орно — ширээн дээр гурван файл хэвтэхэд аль нь
      // алийг нь гэдэг нь нэрнээсээ л мэдэгдэнэ.
      "Content-Disposition": `attachment; filename="vonscent-${type}${
        from || to
          ? `-${from?.slice(0, 10) ?? ""}_${to?.slice(0, 10) ?? ""}`
          : ""
      }.csv"`,
    },
  });
}
