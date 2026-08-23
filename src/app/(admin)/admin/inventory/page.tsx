import {
  InventoryTable,
  type InventoryListRow,
} from "@/features/admin/components/inventory-table";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SEED_PRODUCTS } from "@/features/products/seed";

async function getInventory(): Promise<InventoryListRow[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase
        .from("inventory")
        .select(
          "product_id, on_hand_ml, reserved_ml, low_stock_ml, is_sold_out, products(name, brand)",
        );
      type Row = {
        product_id: string;
        on_hand_ml: number;
        reserved_ml: number;
        low_stock_ml: number;
        is_sold_out: boolean;
        products:
          | { name: string; brand: string }
          | { name: string; brand: string }[]
          | null;
      };
      const rows = (data as Row[] | null) ?? [];
      return rows.map((r) => {
        const prod = Array.isArray(r.products) ? r.products[0] : r.products;
        return {
          productId: r.product_id,
          label: prod ? `${prod.brand} — ${prod.name}` : r.product_id,
          onHand: r.on_hand_ml,
          reserved: r.reserved_ml,
          lowStock: r.low_stock_ml,
          soldOut: r.is_sold_out,
        };
      });
    }
  }
  // Demo fallback
  return SEED_PRODUCTS.map((p) => ({
    productId: p.id,
    label: `${p.brand} — ${p.name}`,
    onHand: p.availableMl,
    reserved: 0,
    lowStock: 20,
    soldOut: p.soldOut,
  }));
}

export default async function AdminInventoryPage() {
  const rows = await getInventory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Үлдэгдэл</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Эх савны ml хяналт (on_hand − reserved = available).
        </p>
      </div>

      <InventoryTable data={rows} />
    </div>
  );
}
