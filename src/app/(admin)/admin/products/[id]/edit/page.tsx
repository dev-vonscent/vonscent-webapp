import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getAdminProduct } from "@/features/admin/api";
import { getUntranslatedNotes } from "@/features/admin/note-translations";
import { ProductEditForm } from "@/features/admin/components/product-edit-form";
import {
  getScentFamilies,
  fetchCustomTags,
  fetchBrands,
  fetchConcentrations,
} from "@/features/taxonomy/api";
import { isImageGenConfigured } from "@/lib/env";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, families, customTagPool, brands, concentrations, notifyOn] =
    await Promise.all([
      getAdminProduct(id),
      getScentFamilies(),
      fetchCustomTags(),
      // Edit reads the *full* list, hidden brands included: a product already
      // on a retired brand must keep showing it rather than silently losing it.
      fetchBrands(),
      // Same reason for concentrations (0085).
      fetchConcentrations(),
      isFeatureEnabled("notifications"),
    ]);
  if (!product) notFound();
  const untranslatedNotes = await getUntranslatedNotes({
    top: product.notesTop,
    heart: product.notesHeart,
    base: product.notesBase,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Бараа
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">Бараа засах</h1>
        {/* Нуугдсан бараа руу холбоос илгээх нь 404 руу хөтөлнө. */}
        {notifyOn && product.status !== "hidden" && (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/admin/broadcasts?product=${encodeURIComponent(product.slug)}`}
            >
              <BellRing className="size-4" />
              Шинэ бараа мэдэгдэл илгээх
            </Link>
          </Button>
        )}
      </div>
      <ProductEditForm
        product={product}
        families={families}
        brands={brands}
        concentrations={concentrations}
        customTagPool={customTagPool}
        aiEnabled={isImageGenConfigured}
        untranslatedNotes={untranslatedNotes}
      />
    </div>
  );
}
