import { SiteHeader } from "@/components/shared/site-header";
import { BottomNav } from "@/components/shared/bottom-nav";
import { WishlistSync } from "@/features/wishlist/sync";

/**
 * The footer arrives through a parallel route slot rather than being rendered
 * here, because it belongs to the home page alone.
 *
 * A slot rather than a `usePathname()` check: `@footer/page.tsx` matches only
 * `/`, and every other route falls to `@footer/default.tsx`, which renders
 * nothing. So the footer is not merely hidden off the home page — it is never
 * rendered, and `getSocialSettings()` (a database read it does on mount) never
 * runs on the other forty-odd shop routes.
 *
 * It also stays a *sibling* of `<main>`. Moving it into the page would have
 * nested it inside `<main>`, where `<footer>` loses its `contentinfo` landmark
 * and screen-reader users lose the jump target.
 */
export default function ShopLayout({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 pb-24 md:pb-0">
        {children}
      </main>
      {footer}
      <BottomNav />
      <WishlistSync />
    </>
  );
}
