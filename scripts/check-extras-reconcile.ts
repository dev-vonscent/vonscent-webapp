/**
 * Нэмэлт бараа, савны тоон нөөцийн reconciliation (extras-shop-plan §14) —
 * ЗӨВХӨН уншина. Prod-д туг (`extras_shop`, `vial_inventory`) нээхийн өмнө
 * бүх мөр 0 байх ёстой.
 *
 *   pnpm check:extras-reconcile-dev
 *   pnpm check:extras-reconcile-prod
 *
 * Нэг read-only transaction дотор уншдаг тул өгөгдөлд хүрэхгүй.
 */
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set.");
  process.exit(1);
}

const CHECKS: { name: string; sql: string }[] = [
  {
    name: "orders.subtotal = Σ order_items.line_total",
    sql: `select count(*)::int n from orders o
           where o.subtotal <> coalesce((select sum(line_total) from order_items i where i.order_id = o.id), 0)`,
  },
  {
    name: "orders.total = subtotal + shipping − discount − loyalty",
    sql: `select count(*)::int n from orders
           where total <> subtotal + shipping_fee - discount - loyalty_used`,
  },
  {
    name: "local_quantity: reserved_qty = Σ reserved мөр",
    sql: `select count(*)::int n from extra_variants v
           where v.inventory_mode = 'local_quantity'
             and v.reserved_qty <> coalesce((select sum(qty) from order_items i
                  where i.extra_variant_id = v.id and i.extra_state = 'reserved'), 0)`,
  },
  {
    name: "vials.reserved = Σ reserved мөр (үнэртэн + тусад нь зарсан сав)",
    sql: `select count(*)::int n from vials v
           where v.reserved <> coalesce((select sum(qty) from order_items i
                  where i.vial_id = v.id and i.vial_state = 'reserved'), 0)`,
  },
  {
    name: "inventory.reserved_ml = төлөөгүй захиалгын ml + шилний түгжээ",
    sql: `select count(*)::int n from inventory inv
           where inv.reserved_ml <> coalesce((
                   select sum(i.ml * i.qty) from order_items i join orders o on o.id = i.order_id
                    where i.product_id = inv.product_id and i.line_kind = 'perfume'
                      and o.status <> 'cancelled' and o.payment_status = 'unpaid'), 0)
                 + coalesce((
                   select sum(l.locked_ml) from leftover_liquid_locks l
                     join extra_products p on p.id = l.extra_product_id
                    where p.product_id = inv.product_id and l.state in ('listed', 'reserved')), 0)`,
  },
  {
    name: "extra_variants: Σ хөдөлгөөн = одоогийн тоо",
    sql: `select count(*)::int n from extra_variants v
           where v.on_hand_qty <> coalesce((select sum(delta_on_hand) from extra_movements m where m.extra_variant_id = v.id), 0)
              or v.reserved_qty <> coalesce((select sum(delta_reserved) from extra_movements m where m.extra_variant_id = v.id), 0)`,
  },
  {
    name: "vials: Σ хөдөлгөөн = одоогийн тоо",
    sql: `select count(*)::int n from vials v
           where coalesce(v.on_hand, 0) <> coalesce((select sum(delta_on_hand) from vial_movements m where m.vial_id = v.id), 0)
              or v.reserved <> coalesce((select sum(delta_reserved) from vial_movements m where m.vial_id = v.id), 0)`,
  },
];

async function main() {
  const c = await connectDb(url!);
  let bad = 0;
  try {
    await c.query("begin transaction read only");
    for (const check of CHECKS) {
      const { rows } = await c.query<{ n: number }>(check.sql);
      const n = rows[0]?.n ?? 0;
      bad += n === 0 ? 0 : 1;
      console.log(
        `${n === 0 ? "✓" : "✖"} ${check.name}${n ? ` — ${n} зөрүү` : ""}`,
      );
    }
  } finally {
    await c.query("rollback").catch(() => {});
    await c.end();
  }
  console.log(bad === 0 ? "\n✅ Зөрүүгүй." : `\n✖ ${bad} шалгалт зөрүүтэй.`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
