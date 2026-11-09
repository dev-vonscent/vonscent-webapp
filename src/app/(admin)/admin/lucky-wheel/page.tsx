import { getWheelAdmin } from "@/features/admin/api";
import { LuckyWheelAdmin } from "@/features/admin/components/lucky-wheel-admin";

export default async function AdminLuckyWheelPage() {
  const { prizes, settings, bundleChoices, productOptions } =
    await getWheelAdmin();
  return (
    <LuckyWheelAdmin
      prizes={prizes}
      settings={settings}
      bundleChoices={bundleChoices}
      productOptions={productOptions}
    />
  );
}
