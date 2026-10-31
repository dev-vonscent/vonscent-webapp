import { getWheelReport } from "@/features/admin/api";
import { LuckyWheelReport } from "@/features/admin/components/lucky-wheel-report";
import { rangeSummary } from "@/features/admin/lib/date-range";
import type { SpinType } from "@/db/types";

const SPIN_TYPES: SpinType[] = ["free", "order", "paid"];

export default async function AdminLuckyWheelReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>;
}) {
  const params = await searchParams;
  const filter = {
    from: params.from,
    to: params.to,
    type: SPIN_TYPES.find((t) => t === params.type),
  };
  const report = await getWheelReport(filter);
  return (
    <LuckyWheelReport
      report={report}
      filter={filter}
      summary={rangeSummary(filter.from, filter.to)}
    />
  );
}
