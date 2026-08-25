import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { getSidebarBadges } from "@/features/admin/api";

// Admin screens must always show live data — never serve them from the
// static cache even though their fetchers no longer read cookies.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const badges = await getSidebarBadges();
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <AdminSidebar badges={badges} />
      <main className="bg-muted/30 flex-1 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
