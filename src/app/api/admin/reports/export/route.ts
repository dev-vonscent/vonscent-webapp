import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportData, getAdminProducts } from "@/features/admin/api";
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

  const type = new URL(req.url).searchParams.get("type") ?? "sales";
  let rows: (string | number)[][] = [];

  if (type === "products") {
    const report = await getReportData();
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
    const { data } = supabase
      ? await supabase
          .from("orders")
          .select("*")
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false })
      : { data: [] };
    const orders = (data as OrderRow[] | null) ?? [];
    rows = [
      ["Дугаар", "Огноо", "Хэрэглэгч", "Барааны дүн", "Хямдрал", "Нийт", "Төлөв"],
      ...orders.map((o) => [
        o.order_no,
        new Date(o.created_at).toISOString().slice(0, 10),
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
      "Content-Disposition": `attachment; filename="vonscent-${type}.csv"`,
    },
  });
}
