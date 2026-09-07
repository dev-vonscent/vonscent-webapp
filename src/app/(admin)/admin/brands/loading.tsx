import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Брэнд — logo + name rows, then the add form. */
export default function Loading() {
  return <AdminListSkeleton rows={10} />;
}
