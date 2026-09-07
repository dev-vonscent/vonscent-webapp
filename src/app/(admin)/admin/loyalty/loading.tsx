import { SettingsSkeleton } from "@/components/shared/skeletons";

/** V point — a single card of earn/redeem rules. */
export default function Loading() {
  return <SettingsSkeleton cards={[4]} />;
}
