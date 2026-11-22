import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShopExtraListItem } from "../api";
import { ExtraCard } from "./extra-card";

/**
 * «Дагалдах хэрэгсэл» (`/accessories`, extras-shop-plan §19.3) — бэлгийн сав,
 * грамын сав, шприц. Бараа цөөн тул ангиллаар хэсэглэхгүй, шүүлтүүргүй: нэг
 * grid, ангиллын дарааллаар (getShopExtras). Ангиллын нэр ч гарахгүй —
 * барааны нэр нь төрлөө хэлнэ.
 * Карт нь үнэртнийхээс жижиг (`compact`, утсан дээр 3 багана) — бүгдийг
 * нэг харцаар харна.
 */
export function AccessoriesCatalog({ items }: { items: ShopExtraListItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="lg"
        className="mt-6"
        icon={PackageSearch}
        title="Дагалдах хэрэгсэл удахгүй нэмэгдэнэ"
        description="Бэлгийн сав, грамын сав, шприц энд гарна. Тэр хооронд үнэртнүүдээ сонирхоорой."
        action={
          <Button asChild variant="outline">
            <Link href="/catalog">Үнэртэн үзэх</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 md:gap-x-4 md:gap-y-8 lg:grid-cols-6 2xl:grid-cols-8">
      {items.map((e) => (
        <li key={e.id}>
          <ExtraCard
            extra={e}
            href={`/extras/${e.slug}`}
            quickAdd
            compact
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1536px) 16vw, 200px"
          />
        </li>
      ))}
    </ul>
  );
}
