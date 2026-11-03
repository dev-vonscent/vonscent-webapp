import { PageHeader } from "@/components/shared/page-header";
import { LuckyWheelTabs } from "@/features/admin/components/lucky-wheel-tabs";

export default function AdminLuckyWheelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Азын хүрд" />
      <LuckyWheelTabs />
      {children}
    </div>
  );
}
