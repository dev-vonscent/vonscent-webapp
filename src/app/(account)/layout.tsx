import { SiteHeader } from "@/components/shared/site-header";
import { BottomNav } from "@/components/shared/bottom-nav";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">{children}</div>
      </main>
      <BottomNav />
    </>
  );
}
