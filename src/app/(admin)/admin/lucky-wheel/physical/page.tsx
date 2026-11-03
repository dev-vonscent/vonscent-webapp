import { getWheelPhysicalPrizes } from "@/features/admin/api";
import { GrandPrizesAdmin } from "@/features/admin/components/grand-prizes-admin";

export default async function AdminLuckyWheelPhysicalPage() {
  const rows = await getWheelPhysicalPrizes();
  return <GrandPrizesAdmin rows={rows} />;
}
