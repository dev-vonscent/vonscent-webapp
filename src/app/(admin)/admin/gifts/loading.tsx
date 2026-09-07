import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Сарын бэлэг — the month's sample pool, then the add form. */
export default function Loading() {
  return <AdminListSkeleton rows={6} />;
}
