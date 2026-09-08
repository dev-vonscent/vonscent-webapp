import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Бэлгийн үнэрүүд — бэлгийн сангийн жагсаалт, дараа нь сонголтын хэсэг. */
export default function Loading() {
  return <AdminListSkeleton rows={6} />;
}
