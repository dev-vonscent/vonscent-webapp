import { SettingsSkeleton } from "@/components/shared/skeletons";

/** Контент — блог, FAQ, "Бидний тухай" editors behind one tab strip. */
export default function Loading() {
  return <SettingsSkeleton cards={[2, 6]} />;
}
