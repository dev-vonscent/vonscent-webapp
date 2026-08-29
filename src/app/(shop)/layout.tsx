import { SiteHeader } from "@/components/shared/site-header";
import { BottomNav } from "@/components/shared/bottom-nav";
import { SiteFooter } from "@/components/shared/site-footer";
import { WishlistSync } from "@/features/wishlist/sync";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 pb-24 md:pb-0">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
      <WishlistSync />
    </>
  );
}
