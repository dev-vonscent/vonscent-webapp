import * as Sentry from "@sentry/nextjs";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getPublicLeaderboards } from "../server";
import { TopCustomers } from "./top-customers";

/**
 * Нүүр хуудасны «Top 3 хэрэглэгч» (feature flag `user_tiers`). Нэр,
 * зураг, хугацааны захиалгын дүн харагдана. Хэн ч худалдан авалт хийгээгүй бол
 * хоосон тавцан харуулахгүй — хэсэг өөрөө нуугдана.
 */
export async function TopCustomersSection() {
  if (!(await isFeatureEnabled("user_tiers"))) return null;
  const boards = await getPublicLeaderboards().catch((err) => {
    Sentry.captureException(err);
    return null;
  });
  if (!boards || boards.all.top.length === 0) return null;
  return (
    <TopCustomers boards={boards} headingClassName="text-2xl sm:text-3xl" />
  );
}
