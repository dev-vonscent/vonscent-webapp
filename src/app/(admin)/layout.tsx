import { AdminSidebar } from "@/features/admin/components/admin-sidebar";

// Admin screens must always show live data — never serve them from the
// static cache. The layout itself no longer fetches anything: the sidebar
// counts moved to /api/admin/badges, because awaiting them here re-ran two
// Supabase queries on every admin navigation and delayed the route swap.
export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <AdminSidebar />
      {/* max-w-5xl is a reading measure borrowed from the storefront; this is a
          table surface, so on a wide operator monitor it squeezed 7 columns
          into 1024px and left the rest of the screen empty. */}
      <main className="bg-muted/30 flex-1 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
