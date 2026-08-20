import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/features/admin/components/product-form";
import { getScentFamilies } from "@/features/taxonomy/api";

export default async function NewProductPage() {
  const families = await getScentFamilies();
  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Бараа руу буцах
      </Link>
      <h1 className="font-serif text-2xl font-semibold">Шинэ бараа нэмэх</h1>
      <ProductForm families={families} />
    </div>
  );
}
