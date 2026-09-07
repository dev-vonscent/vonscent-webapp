import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Нүүрийн хэсэг — one card per rail, then the add form. */
export default function Loading() {
  return <AdminListSkeleton rows={5} thumb={false} />;
}
