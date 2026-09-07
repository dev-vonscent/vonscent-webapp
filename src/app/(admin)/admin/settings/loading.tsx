import { SettingsSkeleton } from "@/components/shared/skeletons";

/** Тохиргоо — store details, shipping zones, coupons, loyalty. */
export default function Loading() {
  return <SettingsSkeleton cards={[4, 4, 2, 4]} />;
}
