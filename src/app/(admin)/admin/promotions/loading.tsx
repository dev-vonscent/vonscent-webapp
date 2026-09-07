import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Урамшуулал — the coupon table, then the create form. */
export default function Loading() {
  return <AdminListSkeleton rows={10} thumb={false} />;
}
