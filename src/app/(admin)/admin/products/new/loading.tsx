import { ProductFormSkeleton } from "@/components/shared/skeletons";

/**
 * The product form. It sat under `admin/products/loading.tsx` and so opened as
 * a *table* skeleton — eight list rows where a form was about to appear. That
 * predates the newer route skeletons; it is fixed here and in `[id]/edit`.
 */
export default function Loading() {
  return <ProductFormSkeleton />;
}
