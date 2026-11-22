import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getAdminGiftCardDesigns } from "@/features/gift-cards/admin-api";
import { GiftCardFace } from "@/features/gift-cards/components/gift-card-face";
import { GiftCardDesignEditor } from "@/features/gift-cards/components/admin/gift-card-design-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бэлгийн картын загвар" };

/**
 * Загварууд (gift-cards-plan §9.2) — дизайнерын дэвсгэр зургийг энд оруулна,
 * улирлын загварыг (Цагаан сар г.м.) асааж/унтраана.
 */
export default async function AdminGiftCardDesignsPage() {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const designs = await getAdminGiftCardDesigns();
  return (
    <div className="space-y-6">
      <Link
        href="/admin/gift-cards"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Бэлгийн карт
      </Link>
      <PageHeader
        title="Картын загвар"
        count={designs.length}
        description="Дэвсгэр зураг текстгүй байна — нэр, дүн, мэндчилгээг систем өөрөө тавина. Идэвхгүй загвар худалдан авах хуудсанд харагдахгүй, хуучин картууд өөрийн загвараараа хэвээр."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {designs.map((d) => (
          <li key={d.id} className="bg-card space-y-3 rounded-xl p-3">
            <GiftCardFace
              design={d}
              text={{ amount: 100000, recipientName: "Сараа", message: "", fromName: "Болд" }}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.title}</p>
                <p className="text-muted-foreground text-xs">
                  {d.isActive ? "Харагдана" : "Нуусан"} · {d.imageUrl ? "Зурагтай" : "Зураггүй (цул өнгө)"}
                </p>
              </div>
              <GiftCardDesignEditor design={d} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
