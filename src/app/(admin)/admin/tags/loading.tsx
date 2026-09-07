import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Нэмэлт таг — name rows with usage counts, then the add form. */
export default function Loading() {
  return <AdminListSkeleton rows={8} thumb={false} />;
}
