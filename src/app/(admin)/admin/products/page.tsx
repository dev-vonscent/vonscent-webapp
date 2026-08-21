import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminProducts } from "@/features/admin/api";
import { ProductImageCell } from "@/features/admin/components/product-image-cell";
import { formatPrice } from "@/lib/format";
import { GENDER_LABEL, type Gender } from "@/lib/constants";

export default async function AdminProductsPage() {
  const products = await getAdminProducts();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">Бараа</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            Бараа нэмэх
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Зураг</th>
                <th className="px-4 py-3 font-medium">Нэр</th>
                <th className="px-4 py-3 font-medium">Брэнд</th>
                <th className="px-4 py-3 font-medium">Хүйс</th>
                <th className="px-4 py-3 font-medium">Эхлэх үнэ</th>
                <th className="px-4 py-3 font-medium">Үлдэгдэл</th>
                <th className="px-4 py-3 font-medium">Төлөв</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-border hover:bg-muted/30 border-t"
                >
                  <td className="px-4 py-3">
                    <ProductImageCell
                      product={{
                        id: p.id,
                        name: p.name,
                        isActive: p.isActive,
                        imageUrl: p.imageUrl,
                        imageStatus: p.imageStatus,
                        imageResultUrl: p.imageResultUrl,
                        imageGenId: p.imageGenId,
                        imagePrompt: p.imagePrompt,
                        imageError: p.imageError,
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="text-muted-foreground px-4 py-3">{p.brand}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {GENDER_LABEL[p.gender as Gender]}
                  </td>
                  <td className="px-4 py-3">{formatPrice(p.startingPrice)}</td>
                  <td className="px-4 py-3">{p.availableMl}ml</td>
                  <td className="px-4 py-3">
                    {!p.isActive ? (
                      <Badge variant="secondary">Нуусан</Badge>
                    ) : p.availableMl <= 0 ? (
                      <Badge variant="sale">Дууссан</Badge>
                    ) : p.availableMl <= p.lowStockMl ? (
                      <Badge variant="secondary">Бага</Badge>
                    ) : (
                      <Badge variant="new">Идэвхтэй</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="text-gold-strong inline-flex items-center gap-1 hover:underline"
                    >
                      <Pencil className="size-3.5" /> Засах
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
