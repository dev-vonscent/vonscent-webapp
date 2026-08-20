import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RestockControl } from "@/features/admin/components/restock-control";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SEED_PRODUCTS } from "@/features/products/seed";

interface InvRow {
  productId: string;
  label: string;
  onHand: number;
  reserved: number;
  lowStock: number;
  soldOut: boolean;
}

async function getInventory(): Promise<InvRow[]> {
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Бараа</th>
                <th className="px-4 py-3 font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">Төлөв</th>
                <th className="px-4 py-3 font-medium">Нөхөх</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const available = r.onHand - r.reserved;
                return (
                  <tr key={r.productId} className="border-border border-t">
                    <td className="px-4 py-3 font-medium">{r.label}</td>
                    <td className="px-4 py-3">{r.onHand}ml</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {r.reserved}ml
                    </td>
                    <td className="px-4 py-3 font-medium">{available}ml</td>
                    <td className="px-4 py-3">
                      {r.soldOut || available <= 0 ? (
                        <Badge variant="sale">Дууссан</Badge>
                      ) : available <= r.lowStock ? (
                        <Badge variant="secondary">Бага</Badge>
                      ) : (
                        <Badge variant="new">Хэвийн</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RestockControl productId={r.productId} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
