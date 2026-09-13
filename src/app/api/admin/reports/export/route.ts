import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportData, getAdminProducts } from "@/features/admin/api";
import { ubDateKey, ubIso } from "@/features/admin/lib/date-range";
import type { OrderRow } from "@/db/types";

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
  const fromIso = ubIso(from);
  const toIso = ubIso(to);
  let rows: (string | number)[][] = [];

  if (type === "products") {
    const report = await getReportData({ from, to });
    rows = [
      ["Брэнд", "Нэр", "Тоо", "Орлого"],
      ...report.topProducts.map((p) => [p.brand, p.name, p.qty, p.revenue]),
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
    // sales
    const supabase = createAdminClient();
    let query = supabase
      ?.from("orders")
      .select("*")
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });
    if (query && fromIso) query = query.gte("created_at", fromIso);
    if (query && toIso) query = query.lte("created_at", toIso);
    const { data } = query ? await query : { data: [] };
    const orders = (data as OrderRow[] | null) ?? [];
    rows = [
      [
        "Дугаар",
        "Огноо",
        "Хэрэглэгч",
        "Барааны дүн",
        "Хямдрал",
        "Нийт",
        "Төлөв",
      ],
      ...orders.map((o) => [
        o.order_no,
        // `toISOString()` нь UTC — 08:00-аас өмнө ирсэн захиалга бүр
        // өмнөх өдрөөр бичигдэж байв. Огноо нь дэлгүүрийн бүсээр гарна.
        ubDateKey(new Date(o.created_at)),
        o.contact_name,
        o.subtotal,
        o.discount,
        o.total,
        o.status,
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
