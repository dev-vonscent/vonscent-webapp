import { AdminListSkeleton } from "@/components/shared/skeletons";

/** Үнэрийн төрөл — icon + label rows, then the add form. */
export default function Loading() {
  return <AdminListSkeleton rows={6} />;
}
