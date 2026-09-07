import { getWheelAdmin } from "@/features/admin/api";
import { LuckyWheelAdmin } from "@/features/admin/components/lucky-wheel-admin";

export default async function AdminLuckyWheelPage() {
  const { prizes, settings, report } = await getWheelAdmin();
  return (
    <LuckyWheelAdmin prizes={prizes} settings={settings} report={report} />
  );
}
